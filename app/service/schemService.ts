import path from 'path';
import {readFileSync, writeFileSync} from 'fs';
import {encode, Int, Short, Tag, TagMap, TagObject} from 'nbt-ts'; // 使用 nbt-ts 库处理 NBT 数据
import {fileTypeFromBuffer} from 'file-type';
import Jimp from "jimp";
import {fileURLToPath} from "url";

// 定义块颜色数据文件路径
export const DATA_DIR: string = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');
const BLOCK_JSON_PATH = path.join(DATA_DIR, 'block.json')

// 加载块颜色数据
async function loadBlockJson() {
    const blockJsonBuffer = readFileSync(BLOCK_JSON_PATH); // 读取块颜色数据文件
    return JSON.parse(blockJsonBuffer.toString()); // 解析并返回JSON数据
}

// 将图像转换为Schematic格式的NBT数据
export async function toSchem(imageBuffer: Buffer): Promise<Buffer> {
    // 确认文件类型为PNG
    const imgType = await fileTypeFromBuffer(imageBuffer);
    if (!imgType || imgType.mime !== 'image/png') {
        throw new Error('Invalid image type. Only PNG is supported.'); // 如果不是PNG文件，抛出错误
    }

    // 加载图像
    const img = await Jimp.read(imageBuffer);
    const blockJson = await loadBlockJson(); // 加载块颜色数据
    const width = img.bitmap.width; // 获取图像宽度
    const height = img.bitmap.height; // 获取图像高度

    // 初始化调色板和方块数据
    const palette: { [key: string]: number } = {};
    const paletteArray: string[] = [];
    const blockData = new Uint8Array(width * height);


    // 遍历图像中的每个像素
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x);
            const rgba = Jimp.intToRGBA(img.getPixelColor(x, y));
            const { r, g, b, a } = rgba;

            let closestBlock = 'minecraft:air'; // 初始化为空气方块
            let closestDist = Number.MAX_VALUE; // 初始化为最大距离

            // 寻找最接近颜色的块
            for (const [block, color] of Object.entries(blockJson)) {
                const [br, bg, bb, ba] = color as [number, number, number, number]; // 类型断言
                const dist = Math.sqrt((r - br) ** 2 + (g - bg) ** 2 + (b - bb) ** 2 + (a - ba) ** 2);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestBlock = block; // 更新为最接近的块
                }
            }

            // 如果调色板中没有该块，则添加
            if (!(closestBlock in palette)) {
                palette[closestBlock] = paletteArray.length;
                paletteArray.push(closestBlock);
            }

            blockData[idx] = palette[closestBlock]; // 更新方块数据
        }
    }

    // 创建并设置NBT数据
    const paletteTagMap: TagMap = new Map();
    paletteArray.forEach((block, index) => {
        paletteTagMap.set(`minecraft:${block}`, new Int(index) as unknown as Tag);
    });

    const nbtData: TagObject = {
        Palette: paletteTagMap,
        BlockData: Buffer.from(blockData) as unknown as Tag, // 确保 BlockData 类型正确
        Version: new Int(2),
        Width: new Short(width),
        Height: new Short(1),
        Length: new Short(height),
        DataVersion: new Int(2230)
    };

    return encode('Schematic', nbtData);
}

// 将NBT文件写入磁盘
export function writeNBTFile(filepath: string, buffer: Buffer) {
    writeFileSync(filepath, buffer);
    console.log(`Wrote NBT data to ${filepath}`);
}
