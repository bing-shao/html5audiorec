var recLength = 0,
  recBuffersL = [],
  recBuffersR = [],
  id=0,
  sampleRate;
//=============================================================//
this.onmessage = function(e){
  switch(e.data.command){
    case 'init':
      init(e.data.config);
      break;
    case 'record':
      record(e.data.buffer);
      break;
    case 'exportWAV':
      exportWAV(e.data.type);
      break;
    case 'exportMonoWAV':
      exportMonoWAV(e.data.type);
      break;
    case 'getBuffers':
      getBuffers();
      break;
    case 'upload':
     uoload(e.data.type);
     break;
    case 'clear':
      clear();
      break;
  }
};

function init(config){
  sampleRate = config.sampleRate;
}
function record(inputBuffer){
  recBuffersL.push(inputBuffer[0]);
 // console.log(inputBuffer[0]);
  //recBuffersR.push(inputBuffer[1]);
  recLength += inputBuffer[0].length;
}

function exportWAV(type){
  var bufferL = mergeBuffers(recBuffersL, recLength);
  var bufferR = mergeBuffers(recBuffersR, recLength);
  var interleaved = interleave(bufferL, bufferR);
  var dataview = encodeWAV(interleaved);
  var audioBlob = new Blob([dataview], { type: type });
  this.postMessage(audioBlob);
}

function exportMonoWAV(type){
  var bufferL = mergeBuffers(recBuffersL, recLength);
  var mdata=bufferL;
      for (var i = 0; i < mdata.length; i++){
    	var s = Math.max(-1, Math.min(1, mdata[i]));
    	if(s<0){
    	s=s * 0x8000;
    	var ss=Math.round(s);
    	mdata[i]=ss;
    	}else{
    	s=s * 0x7FFF;
    	var ss=Math.round(s);
    	mdata[i]=ss;
    	}
    	}
  var ws = new WebSocket("ws://192.168.3.103:8080/echo");
  ws.binaryType='arraybuffer';
  ws.onopen = function (event) {
                var data = new Uint8Array(mdata.length*2);
                for(var i =0;i<mdata.length*2;i+=2) {
                	data[i] = mdata[i/2] & 0xFF  ;
                	data[i+1] = mdata[i/2] >>8;
                	if ( data[i+1]<0 ) data[i+1] +=1;
                }
                 ws.send(data);
                 ws.send('');
               };
               ws.onmessage = function (event) {
                 console.log(event.data);
               };
  //var r = new Resampler(sampleRate,16000,1);
 // var resamples = r.resampler(bufferL);
  var dataview = encodeWAV(bufferL, true,16000);
  var audioBlob = new Blob([dataview], { type: type });
  this.postMessage(audioBlob);
}

function getBuffers() {
  var buffers = [];
  buffers.push( mergeBuffers(recBuffersL, recLength) );
  //buffers.push( mergeBuffers(recBuffersR, recLength) );
  this.postMessage(buffers);
}
function clear(){
  recLength = 0;
  recBuffersL = [];
  recBuffersR = [];
}

function mergeBuffers(recBuffers, recLength){
//console.log(recBuffers);
//console.log(recLength);
  var result = new Float32Array(recLength);
  var offset = 0;
  for (var i = 0; i < recBuffers.length; i++){
    result.set(recBuffers[i], offset);
    offset += recBuffers[i].length;
  }
  return result;
}

function interleave(inputL, inputR){
  var length = inputL.length + inputR.length;
  var result = new Float32Array(length);
  var index = 0,
    inputIndex = 0;

  while (index < length){
    result[index++] = inputL[inputIndex];
    result[index++] = inputR[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(output, offset, input){
  for (var i = 0; i < input.length; i++, offset+=2){
    var s = Math.max(-1, Math.min(1, input[i]));
    var ss=s < 0 ? s * 0x8000 : s * 0x7FFF;
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view, offset, string){
  for (var i = 0; i < string.length; i++){
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function encodeWAV(samples, mono,rate){
//console.log(samples, mono,rate);
  var buffer = new ArrayBuffer(44 + samples.length*2 );
  var view = new DataView(buffer);
//  var wavSampleRate = 16000;
//  var r = new Resampler(sampleRate,wavSampleRate,2);
//  var resamples = r.resampler(samples);
//  console.log("input size is :%d\n",samples.length);
//  console.log("output buffer len is:%d\n",resamples.length);
  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 32 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, mono?1:2, true);
  /* sample rate */
  view.setUint32(24, rate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, rate * 4, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 4, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */

  
  view.setUint32(40, samples.length*2, true);

  floatTo16BitPCM(view, 44, samples);
  //view.setUint32(40, resamples.legnth*2, true);

  //floatTo16BitPCM(view, 44, resamples);
  return view;
}

function Resampler(fromSampleRate, toSampleRate, channels) {
    //Input Sample Rate:
    this.fromSampleRate = fromSampleRate;
    //Output Sample Rate:
    this.toSampleRate = toSampleRate;
    //Number of channels:
    this.channels = channels | 0;
    //Type checking the input buffer:
    //Initialize the resampler:
    this.initialize();
}
Resampler.prototype.initialize = function () {
	//Perform some checks:
	if (this.fromSampleRate > 0 && this.toSampleRate > 0 && this.channels > 0) {
		if (this.fromSampleRate == this.toSampleRate) {
			//Setup a resampler bypass:
			this.resampler = this.bypassResampler;		//Resampler just returns what was passed through.
            this.ratioWeight = 1;
		}
		else {
            this.ratioWeight = this.fromSampleRate / this.toSampleRate;
			if (this.fromSampleRate < this.toSampleRate) {
				/*
					Use generic linear interpolation if upsampling,
					as linear interpolation produces a gradient that we want
					and works fine with two input sample points per output in this case.
				*/
				this.compileLinearInterpolationFunction();
				this.lastWeight = 1;
			}
			else {
				/*
					Custom resampler I wrote that doesn't skip samples
					like standard linear interpolation in high downsampling.
					This is more accurate than linear interpolation on downsampling.
				*/
				this.resampler = this.multiTapFunc;//compileMultiTapFunction();
				this.tailExists = false;
				this.lastWeight = 0;
			}
			this.initializeBuffers();
		}
	}
	else {
		throw(new Error("Invalid settings specified for the resampler."));
	}
}

Resampler.prototype.multiTapFunc = function (buffer) {
		var outputOffset = 0; 
		var bufferLength = buffer.length;
		if (bufferLength > 0) {  
			var weight = this.ratioWeight;
			var output0 = 0;
			var output1 = 0;
			var actualPosition = 0;
			var amountToNext = 0;
			var alreadyProcessedTail = !this.tailExists;  
			this.tailExists = false;
			var outputBufferSize = (Math.ceil(buffer.length * this.toSampleRate / this.fromSampleRate / this.channels * 1.000000476837158203125) * this.channels) + this.channels;

			var outputBuffer = new Float32Array(outputBufferSize);//this.outputBuffer;
			var currentPosition = 0;
			do { 
				if (alreadyProcessedTail) {
						weight = 3;
						output0 = 0;
						output1 = 0;
				}else{
						weight = this.lastWeight;
						output0 = this.lastOutput[0];
						output1 = this.lastOutput[1];
						alreadyProcessedTail = true; 
				}  
				while (weight > 0 && actualPosition < bufferLength) {
						amountToNext = 1 + actualPosition - currentPosition; 
						if (weight >= amountToNext) {
								output0 += buffer[actualPosition++] * amountToNext;
								output1 += buffer[actualPosition++] * amountToNext;
								currentPosition = actualPosition;
								weight -= amountToNext;    
						}
						else {
								output0 += buffer[actualPosition] * weight;
								output1 += buffer[actualPosition + 1] * weight;
								currentPosition += weight;  
								weight = 0;
								break;
						}       
				} 
				if (weight <= 0) {outputBuffer[outputOffset++] = output0 / 3;outputBuffer[outputOffset++] = output1 / 3;}
				else {  
						this.lastWeight = weight;
						this.lastOutput[0] = output0;
						this.lastOutput[1] = output1;
						this.tailExists = true; 
						break;
				}
		} while (actualPosition < bufferLength); 
}
return outputBuffer;
}
Resampler.prototype.compileLinearInterpolationFunction = function () {
	var toCompile = "var outputOffset = 0;\
    if (bufferLength > 0) {\
        var buffer = this.inputBuffer;\
        var weight = this.lastWeight;\
        var firstWeight = 0;\
        var secondWeight = 0;\
        var sourceOffset = 0;\
        var outputOffset = 0;\
        var outputBuffer = this.outputBuffer;\
        for (; weight < 1; weight += " + this.ratioWeight + ") {\
            secondWeight = weight % 1;\
            firstWeight = 1 - secondWeight;";
            for (var channel = 0; channel < this.channels; ++channel) {
                toCompile += "outputBuffer[outputOffset++] = (this.lastOutput[" + channel + "] * firstWeight) + (buffer[" + channel + "] * secondWeight);";
            }
        toCompile += "}\
        weight -= 1;\
        for (bufferLength -= " + this.channels + ", sourceOffset = Math.floor(weight) * " + this.channels + "; sourceOffset < bufferLength;) {\
            secondWeight = weight % 1;\
            firstWeight = 1 - secondWeight;";
            for (var channel = 0; channel < this.channels; ++channel) {
                toCompile += "outputBuffer[outputOffset++] = (buffer[sourceOffset" + ((channel > 0) ? (" + " + channel) : "") + "] * firstWeight) + (buffer[sourceOffset + " + (this.channels + channel) + "] * secondWeight);";
            }
            toCompile += "weight += " + this.ratioWeight + ";\
            sourceOffset = Math.floor(weight) * " + this.channels + ";\
        }";
        for (var channel = 0; channel < this.channels; ++channel) {
            toCompile += "this.lastOutput[" + channel + "] = buffer[sourceOffset++];";
        }
        toCompile += "this.lastWeight = weight % 1;\
    }\
    return outputOffset;";
	this.resampler = Function("bufferLength", toCompile);
}
Resampler.prototype.compileMultiTapFunction = function () {
	var toCompile = "var outputOffset = 0;\
    if (bufferLength > 0) {\
        var buffer = this.inputBuffer;\
        var weight = 0;";
        for (var channel = 0; channel < this.channels; ++channel) {
            toCompile += "var output" + channel + " = 0;"
        }
        toCompile += "var actualPosition = 0;\
        var amountToNext = 0;\
        var alreadyProcessedTail = !this.tailExists;\
        this.tailExists = false;\
        var outputBuffer = this.outputBuffer;\
        var currentPosition = 0;\
        do {\
            if (alreadyProcessedTail) {\
                weight = " + this.ratioWeight + ";";
                for (channel = 0; channel < this.channels; ++channel) {
                    toCompile += "output" + channel + " = 0;"
                }
            toCompile += "}\
            else {\
                weight = this.lastWeight;";
                for (channel = 0; channel < this.channels; ++channel) {
                    toCompile += "output" + channel + " = this.lastOutput[" + channel + "];"
                }
                toCompile += "alreadyProcessedTail = true;\
            }\
            while (weight > 0 && actualPosition < bufferLength) {\
                amountToNext = 1 + actualPosition - currentPosition;\
                if (weight >= amountToNext) {";
                    for (channel = 0; channel < this.channels; ++channel) {
                        toCompile += "output" + channel + " += buffer[actualPosition++] * amountToNext;"
                    }
                    toCompile += "currentPosition = actualPosition;\
                    weight -= amountToNext;\
                }\
                else {";
                    for (channel = 0; channel < this.channels; ++channel) {
                        toCompile += "output" + channel + " += buffer[actualPosition" + ((channel > 0) ? (" + " + channel) : "") + "] * weight;"
                    }
                    toCompile += "currentPosition += weight;\
                    weight = 0;\
                    break;\
                }\
            }\
            if (weight <= 0) {";
                for (channel = 0; channel < this.channels; ++channel) {
                    toCompile += "outputBuffer[outputOffset++] = output" + channel + " / " + this.ratioWeight + ";"
                }
            toCompile += "}\
            else {\
                this.lastWeight = weight;";
                for (channel = 0; channel < this.channels; ++channel) {
                    toCompile += "this.lastOutput[" + channel + "] = output" + channel + ";"
                }
                toCompile += "this.tailExists = true;\
                break;\
            }\
        } while (actualPosition < bufferLength);\
    }\
    return outputOffset;";
	this.resampler = Function("bufferLength", toCompile);
}
Resampler.prototype.bypassResampler = function (upTo) {
    return upTo;
}
Resampler.prototype.initializeBuffers = function () {
	//Initialize the internal buffer:
//    var outputBufferSize = (Math.ceil(this.inputBuffer.length * this.toSampleRate / this.fromSampleRate / this.channels * 1.000000476837158203125) * this.channels) + this.channels;
	try {
//		this.outputBuffer = new Float32Array(outputBufferSize);
		this.lastOutput = new Float32Array(this.channels);
	}
	catch (error) {
		this.outputBuffer = [];
		this.lastOutput = [];
	}
}
