import fs from 'node:fs';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import { gzipSync, gunzipSync } from 'zlib';

export default class Stenography
{

	public png : PNG;

	public constructor(png : PNG) {

		if(png.data.length < 4){
			throw new Error('Cant use this PNG file');
		}

		this.png = png;

	}

	/**
	 * Открыть существующий файл
	 */
	public static async openPNG(path : string) : Promise<Stenography>
	{

		return new Promise(resolve => {

			return  fs.createReadStream(path)
				.pipe(new PNG())
				.on('parsed', function () {
					resolve(
						new Stenography(this)
					);
				});

		});

	}

	/**
	 * Максимальный размер записываемых данных
	 */
	public getAvailableEncodeBytes() : number
	{
		return Math.floor(this.png.data.length / 4) * 3 / 8;
	}

	/**
	 * Раскодировать изображение
	 */
	public decode(binary : boolean = false) : string | Buffer
	{

		let length = 0;
		for (let i = 0; i < 4; i++) {
			length |= this.png.data[i] << (i * 8);
		}

		if(length <= this.getAvailableEncodeBytes()){

			let bytes: number[] = [];
			let dataBitIndex = 0;
			let currentByte = 0;

			for (let i = 4; i < this.png.data.length; i += 4) {
				for (let j = 0; j < 3; j++) {
					if (dataBitIndex < length * 8) {
						let bit = this.png.data[i + j] & 1;
						currentByte = (currentByte << 1) | bit;
						dataBitIndex++;

						if (dataBitIndex % 8 === 0) {
							bytes.push(currentByte);
							currentByte = 0;
						}
					}
				}
			}

			let unzipBinaryData = gunzipSync(
				Buffer.from(bytes)
			)

			return binary
				? unzipBinaryData
				: new TextDecoder().decode(
					unzipBinaryData
				);

		}

		throw new Error('Cant decode this picture');

	}

	/**
	 * Закодировать изображение
	 */
	public encode(outputPath : string, data : string | Buffer) : Promise<void>
	{

		let binaryData = typeof data === 'string'
			? Buffer.from(data, 'utf-8')
			: Buffer.from(data);

		let gzipBinaryData = gzipSync(binaryData);

		if (gzipBinaryData.length > this.getAvailableEncodeBytes()) {
			throw new Error('Message is too long');
		}

		let outputBuffer = Buffer.from(this.png.data);

		// Записываем длину данных
		for (let i = 0; i < 4; i++) {
			outputBuffer[i] = (gzipBinaryData.length >> (i * 8)) & 0xFF;
		}

		let dataBitIndex = 0;

		for (let i = 4; i < outputBuffer.length; i += 4) {

			for (let j = 0; j < 3; j++) {

				let bit = (dataBitIndex < gzipBinaryData.length * 8)
					? (gzipBinaryData[Math.floor(dataBitIndex / 8)] >> (7 - (dataBitIndex % 8))) & 1
					: crypto.randomInt(2)

				outputBuffer[i + j] = (outputBuffer[i + j] & 0xFE) | bit;
				dataBitIndex++;

			}

		}

		return this.saveBufferToPNG(outputPath, outputBuffer);

	}

	/**
	 * Сохранение картинки
	 */
	protected async saveBufferToPNG(path : string, buffer : Buffer) : Promise<void>
	{

		let outputPicture = new PNG({
			width: this.png.width,
			height: this.png.height
		});

		buffer.copy(outputPicture.data)

		let stream = fs.createWriteStream(path);

		outputPicture.pack().pipe(stream);

		return new Promise(resolve => {
			stream.on('finish', resolve);
		});

	}

	/**
	 * Закодировать изображение с AES ключом
	 */
	public encodeWithKey(outputPath : string, key : string, data : string | Buffer) : Promise<void>
	{

		let cryptoKey = crypto.createHash('sha256').update(key).digest();

		let binaryData = typeof data === 'string'
			? Buffer.from(data, 'utf-8')
			: Buffer.from(data);

		let iv = crypto.randomBytes(16);
		let cipher = crypto.createCipheriv('aes-256-cbc', cryptoKey, iv);
		let encryptedData = Buffer.concat([cipher.update(binaryData), cipher.final()]);

		let finalData = Buffer.concat([iv, encryptedData]);

		return this.encode(outputPath, finalData);

	}

	/**
	 * Раскодировать изображение с AES ключом
	 */
	public decodeWithKey(key : string, binary : boolean = false) : string | Buffer
	{

		let cryptoKey = crypto.createHash('sha256').update(key).digest();

		let encodedData = <Buffer>this.decode(true);

		let iv = encodedData.slice(0, 16);
		let encryptedData = encodedData.slice(16);

		let decipher = crypto.createDecipheriv('aes-256-cbc', cryptoKey, iv);
		let decryptedData = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

		// Возвращаем расшифрованные данные
		return binary ? decryptedData : new TextDecoder().decode(decryptedData);

	}

	/**
	 * Закодировать файл внутрь изображения
	 */
	public encodeFile(outputPath : string, dataPath : string) : Promise<void>
	{

		let dataBuffer = fs.readFileSync(dataPath);

		return this.encode(outputPath, dataBuffer);

	}

	/**
	 * Раскодировать файл внутри изображения
	 */
	public decodeFile(dataPath : string) : void
	{

		let decode = this.decode(true);

		fs.writeFileSync(dataPath, decode);

	}

	/**
	 * Закодировать файл внутрь изображения с AES ключом
	 */
	public encodeFileWithKey(outputPath : string, key : string, dataPath : string) : Promise<void>
	{

		let dataBuffer = fs.readFileSync(dataPath);

		return this.encodeWithKey(outputPath, key, dataBuffer);

	}

	/**
	 * Раскодировать файл внутри изображения с AES ключем
	 */
	public decodeFileWithKey(dataPath : string, key : string) : void
	{

		let decode = this.decodeWithKey(key, true);

		fs.writeFileSync(dataPath, decode);

	}

}