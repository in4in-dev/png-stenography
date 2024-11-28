import fs from 'node:fs';
import crypto from 'node:crypto';
import {PNG} from 'pngjs';
import { gzipSync, gunzipSync } from 'zlib';
import * as process from "node:process";

export default class Stenography
{

	public png : PNG;

	public constructor(png : PNG) {

		if(png.data.length < 4){
			throw new Error('Cant use this PNG file');
		}

		this.png = png;

	}

	protected hashData(binaryData : Buffer) : Buffer
	{
		return crypto.createHash('sha256').update(binaryData).digest();
	}

	protected deriveAESKey(key : string) : Buffer
	{
		return crypto.createHash('sha256').update(key).digest();
	}

	protected unmask(pixels : Buffer) : Buffer
	{

		let bytes: number[] = [];
		let dataBitIndex = 0;
		let currentByte = 0;

		for (let i = 0; i < pixels.length; i += 4) {

			for (let j = 0; j < 3; j++) {

				let bit = pixels[i + j] & 1;

				currentByte = (currentByte << 1) | bit;
				dataBitIndex++;

				if (dataBitIndex % 8 === 0) {
					bytes.push(currentByte);
					currentByte = 0;
				}

			}

		}

		return Buffer.from(bytes);

	}

	protected mask(pixels : Buffer, data : Buffer) : Buffer
	{

		let outputBuffer = Buffer.from(pixels);

		let dataBitIndex = 0;

		for (let i = 0; i < outputBuffer.length; i += 4) {

			for (let j = 0; j < 3; j++) {

				let bit = (dataBitIndex < data.length * 8)
					? (data[Math.floor(dataBitIndex / 8)] >> (7 - (dataBitIndex % 8))) & 1
					: crypto.randomInt(2)

				outputBuffer[i + j] = (outputBuffer[i + j] & 0xFE) | bit;
				dataBitIndex++;

			}

		}

		return outputBuffer;

	}

	protected clone(buffer : Buffer | null = null) : Stenography
	{

		let outputPicture = new PNG({
			width: this.png.width,
			height: this.png.height
		});

		if(!buffer){
			buffer = this.png.data;
		}

		buffer.copy(outputPicture.data);

		return new Stenography(
			outputPicture
		);

	}

	protected getAvailableEncodeBytes() : number
	{
		return Math.floor(this.png.data.length / 4) * 3 / 8;
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
	 * Свободное место в хранилище
	 */
	public getMemorySize() : number
	{
		return this.getAvailableEncodeBytes() - 4 - 32;
	}

	/**
	 * Раскодировать изображение
	 */
	public decode(binary : boolean = false) : string | Buffer
	{

		let meta = this.unmask(
			this.png.data.slice(0, 96 * 4)
		);

		let length = meta.readUInt32BE();
		let hash = meta.slice(4, 36);

		let data = this.unmask(this.png.data).slice(36, 36 + length);

		if(!this.hashData(data).equals(hash)){
			throw new Error('Cant decode this container');
		}

		let unzippedData = gunzipSync(data);

		return binary
			? unzippedData
			: new TextDecoder().decode(
				unzippedData
			);

	}

	/**
	 * Закодировать изображение
	 */
	public encode(data : string | Buffer) : Stenography
	{

		let binaryData = typeof data === 'string'
			? Buffer.from(data, 'utf-8')
			: Buffer.from(data);

		/**
		 * Сжимаем для экономии места
		 */
		let compressedBinaryData = gzipSync(binaryData);

		/**
		 * Записываем длину данных
		 */
		let length = Buffer.alloc(4);
		length.writeUInt32BE(compressedBinaryData.length, 0);

		/**
		 * Записываем хэш данных
		 */
		let hash = this.hashData(compressedBinaryData);

		/**
		 * Собираем все вместе
		 */
		let serializedData = Buffer.concat([
			length,
			hash,
			compressedBinaryData
		]);

		if (serializedData.length > this.getAvailableEncodeBytes()) {
			throw new Error('Message is too long');
		}

		return this.clone(
			this.mask(this.png.data, serializedData)
		);

	}

	/**
	 * Сохранение картинки
	 */
	public async saveToFile(path : string) : Promise<void>
	{

		let stream = fs.createWriteStream(path);

		this.png.pack().pipe(stream);

		return new Promise(resolve => {
			stream.on('finish', resolve);
		});

	}

	/**
	 * Закодировать изображение с AES ключом
	 */
	public encodeWithKey(key : string, data : string | Buffer) : Stenography
	{

		let cryptoKey = this.deriveAESKey(key);

		let binaryData = typeof data === 'string'
			? Buffer.from(data, 'utf-8')
			: Buffer.from(data);

		let iv = crypto.randomBytes(16);
		let cipher = crypto.createCipheriv('aes-256-cbc', cryptoKey, iv);
		let encryptedData = Buffer.concat([cipher.update(binaryData), cipher.final()]);

		let finalData = Buffer.concat([iv, encryptedData]);

		return this.encode(finalData);

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
	public encodeFile(fromDataPath : string) : Stenography
	{

		let dataBuffer = fs.readFileSync(fromDataPath);

		return this.encode(dataBuffer);

	}

	/**
	 * Раскодировать файл внутри изображения
	 */
	public decodeFile(toDataPath : string) : void
	{

		let decode = this.decode(true);

		fs.writeFileSync(toDataPath, decode);

	}

	/**
	 * Закодировать файл внутрь изображения с AES ключом
	 */
	public encodeFileWithKey(key : string, fromDataPath : string) : Stenography
	{

		let dataBuffer = fs.readFileSync(fromDataPath);

		return this.encodeWithKey(key, dataBuffer);

	}

	/**
	 * Раскодировать файл внутри изображения с AES ключем
	 */
	public decodeFileWithKey(key : string, toDataPath : string) : void
	{

		let decode = this.decodeWithKey(key, true);

		fs.writeFileSync(toDataPath, decode);

	}

}