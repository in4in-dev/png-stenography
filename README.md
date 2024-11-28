# NodeJS PNG Stenography

### Hide your message or file into PNG picture!

## Hide text message into picture

```javascript
//Encode
let input = await Stenography.openPNG('input.png');
await input.encode('My Message').saveToFile('output.png');
	
//Decode
let output = await Stenography.openPNG('output.png');
let message = output.decode(); //My Message
```

## Hide encrypted message into picture

```javascript
let key = 'My AES Key';

//Encode
let input = await Stenography.openPNG('input.png');
await input.encodeWithKey(key, 'My Message').saveToFile('output.png');
	
//Decode
let output = await Stenography.openPNG('output.png');
let message = output.decodeWithKey(key); //My message
```

## Hide file into picture

```javascript
//Encode
let input = await Stenography.openPNG('input.png');
await input.encodeFile('data.zip').saveToFile('output.png');
	
//Decode
let output = await Stenography.openPNG('output.png');
output.decodeFile('result.zip');
```

## Hide encrypted file into picture

```javascript
let key = 'My AES Key';

//Encode
let input = await Stenography.openPNG('input.png');
await input.encodeFileWithKey(key, 'data.zip').saveToFile('output.png');
	
//Decode
let output = await Stenography.openPNG('output.png');
output.decodeFileWithKey(key, 'result.zip'); 
```