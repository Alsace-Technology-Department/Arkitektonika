import express from 'express';
import fileUpload, { UploadedFile } from 'express-fileupload';
import Arkitektonika, { SCHEMATIC_DIR } from "../../Arkitektonika.js";
import * as fs from 'fs';
import path from 'path';
import { decode } from 'nbt-ts';
import Pako from 'pako';
import { toSchem } from "../../service/schemService.js";

// 配置文件上传选项
const UPLOAD_OPTIONS: fileUpload.Options = {
    abortOnLimit: true,
    useTempFiles: true,
    preserveExtension: "schematic".length,
    createParentPath: true,
    safeFileNames: true,
    limits: {},
    uploadTimeout: 1000 * 15
};

// 处理预检请求
const handleOptionsRequest = (req: express.Request, res: express.Response) => {
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.sendStatus(204);
};

// 处理文件上传和验证
const validateNBTFile = async (file: UploadedFile, app: Arkitektonika) => {
    const content = fs.readFileSync(file.tempFilePath);
    const deflated = Buffer.from(Pako.ungzip(content));
    const result = decode(deflated);

    if (result.value == null) {
        throw new Error("decoded value is null");
    }

    if (result.length > app.config.maxSchematicSize) {
        fs.unlinkSync(file.tempFilePath);
        throw new Error(`Submitted NBT file exceeds max size of ${app.config.maxSchematicSize} bytes`);
    }

    return result;
};

const validateImageFile = async (file: UploadedFile, app: Arkitektonika) => {
    const content = fs.readFileSync(file.tempFilePath); // 读取临时文件内容
    const buffer = await toSchem(content); // 将图像转换为 Schematic NBT 格式
    const result = decode(buffer);

    if (result.value == null) {
        throw new Error("decoded value is null");
    }

    if (result.length > app.config.maxSchematicSize) {
        fs.unlinkSync(file.tempFilePath);
        throw new Error(`Submitted NBT file exceeds max size of ${app.config.maxSchematicSize} bytes`);
    }

    const compressed = Buffer.from(Pako.gzip(buffer)); // 将 Uint8Array 转换为 Buffer

    return { buffer: compressed, fileName: path.basename(file.name, path.extname(file.name)) + '.schem' }; // 返回压缩后的 schem 文件内容和文件名
};

// 生成下载和删除键

const generateKeys = async (app: Arkitektonika) => {
    const downloadKey = await app.dataStorage.generateDownloadKey(app.config.maxIterations);
    const deleteKey = await app.dataStorage.generateDeletionKey(app.config.maxIterations);
    return { downloadKey, deleteKey };
};

// 存储记录
const storeSchematicRecord = async (app: Arkitektonika, fileContent: Buffer, fileName: string, downloadKey: string, deleteKey: string) => {
    const record = await app.dataStorage.storeSchematicRecord({
        downloadKey,
        deleteKey,
        fileName
    });

    fs.writeFileSync(path.join(SCHEMATIC_DIR, downloadKey), fileContent); // 将内容写入文件
    return record;
};

// 定义 /upload 路由
export const UPLOAD_ROUTER = (app: Arkitektonika, router: express.Application) => {
    router.options('/upload', handleOptionsRequest);

    router.post('/upload', fileUpload(UPLOAD_OPTIONS), async (req, res) => {
        const file = req.files?.schematic as UploadedFile;

        if (!file) {
            return res.status(400).send({ error: 'Missing file' });
        }

        try {
            await validateNBTFile(file, app);
            const { downloadKey, deleteKey } = await generateKeys(app);
            const record = await storeSchematicRecord(app, fs.readFileSync(file.tempFilePath), file.name, downloadKey, deleteKey);
            res.status(200).send({ download_key: record.downloadKey, delete_key: record.deleteKey });
        } catch (error) {
            app.logger.debug('Invalid request due to invalid nbt content: ' + error);
            fs.unlinkSync(file.tempFilePath);
            return res.status(400).send({ error: 'Invalid nbt content: ' + error });
        }
    });

    return router;
};

export const UPLOADIMG_ROUTER = (app: Arkitektonika, router: express.Application) => {
    router.options('/uploadimg', handleOptionsRequest);

    router.post('/uploadimg', fileUpload(UPLOAD_OPTIONS), async (req, res) => {
        const file = req.files?.image as UploadedFile;

        if (!file) {
            return res.status(400).send({ error: 'Missing file' });
        }

        try {
            const { buffer, fileName } = await validateImageFile(file, app); // 获取压缩后的 schem 文件内容和文件名
            const { downloadKey, deleteKey } = await generateKeys(app);
            const record = await storeSchematicRecord(app, buffer, fileName, downloadKey, deleteKey); // 保存 schem 文件
            res.status(200).send({ download_key: record.downloadKey, delete_key: record.deleteKey });
        } catch (error) {
            app.logger.debug('Invalid request due to invalid nbt content: ' + error);
            fs.unlinkSync(file.tempFilePath);
            return res.status(400).send({ error: 'Invalid nbt content: ' + error });
        }
    });

    return router;
};
