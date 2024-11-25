# NodeJS PNG Stenography

### Hide your message or file into PNG picture!

## Hide text message into picture

```javascript
//Encode
let input = await Stenography.openPNG('input.png');
await input.encode('output.png', 'My Message');
	
//Decode
let output = await Stenography.openPNG('output.png');
let message = output.decode(); //My Message
```

## Hide encrypted message into picture

```javascript
let key = 'My AES Key';

//Encode
let input = await Stenography.openPNG('input.png');
await input.encodeWithKey('output.png', key, 'My Message');
	
//Decode
let output = await Stenography.openPNG('output.png');
let message = output.decodeWithKey(key); //My Message
```

## Hide file into picture

```javascript
//Encode
let input = await Stenography.openPNG('input.png');
await input.encodeFile('output.png', 'data.zip'); //any extension
	
//Decode
let output = await Stenography.openPNG('output.png');
output.decodeFile('result.zip');
```

## Hide encrypted file into picture

```javascript
let key = 'My AES Key';

//Encode
let input = await Stenography.openPNG('input.png');
await input.encodeFileWithKey('output.png', key, 'data.zip'); //any extension
	
//Decode
let output = await Stenography.openPNG('output.png');
output.decodeFileWithKey('result.zip', key); 
```