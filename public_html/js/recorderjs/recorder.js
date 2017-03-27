(function(window){
  var WORKER_PATH = 'js/recorderjs/recorderWorker.js';
  var myBuffer=[];
  var Recorder = function(source, cfg){
    var config = cfg || {};
    var bufferLen = config.bufferLen || 8192;
    this.context = source.context;
    if(!this.context.createScriptProcessor){
       this.node = this.context.createJavaScriptNode(bufferLen, 2, 2);
    } else {
       this.node = this.context.createScriptProcessor(bufferLen, 2, 2);
    }
   
    var worker = new Worker(config.workerPath || WORKER_PATH);
    worker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.context.sampleRate
      }
    });
    var recording = false,
      currCallback;

    this.node.onaudioprocess = function(e){
      if (!recording) return;
	
	
	var mbuffer=e.inputBuffer.getChannelData(0);
    var offlineCtx = new OfflineAudioContext(1,mbuffer.length*16000/this.context.sampleRate,16000);
    //var frameCount = audioContext.sampleRate * 2.0;
	//var myArrayBuffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
    //console.log(myArrayBuffer); 
	//var ubuffer = new ArrayBuffer(mbuffer.length);
	  source = offlineCtx.createBufferSource();	  
      source.buffer = e.inputBuffer;
      source.connect(offlineCtx.destination);
      source.start();
     offlineCtx.startRendering().then(function(renderedBuffer) {
      //  var song = audioContext.createBufferSource();
      //  song.buffer = renderedBuffer;
      //  song.connect(audioContext.destination);
	 worker.postMessage({
       command: 'record',
        buffer: [
        	renderedBuffer.getChannelData(0)
        	//renderedBuffer.getChannelData(1)
          //e.inputBuffer.getChannelData(0),
          //e.inputBuffer.getChannelData(1)
        ]
      });  
      }).catch(function(err) {
          console.log('Rendering failed: ' + err);
          // Note: The promise should reject when startRendering is called a second time on an OfflineAudioContext
      }); 
 	
        
      
    }

    this.configure = function(cfg){
      for (var prop in cfg){
        if (cfg.hasOwnProperty(prop)){
          config[prop] = cfg[prop];
        }
      }
    }

    this.record = function(){
      recording = true;
    }

    this.stop = function(){
      recording = false;
    }

    this.clear = function(){
      worker.postMessage({ command: 'clear' });
    }

    this.getBuffers = function(cb) {
    
      currCallback = cb || config.callback;
      worker.postMessage({ command: 'getBuffers' })
      
    }

    this.exportWAV = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/wav';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'exportWAV',
        type: type
      });
    }

    this.exportMonoWAV = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/wav';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'exportMonoWAV',
        type: type
      });
    }
this.upload = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/wav';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'upload',
        type: type
      });
    }


    worker.onmessage = function(e){
      var blob = e.data;
      currCallback(blob);
    }

    source.connect(this.node);
    this.node.connect(this.context.destination);   // if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.
  };

  Recorder.setupDownload = function(blob, filename){
    var url = (window.URL || window.webkitURL).createObjectURL(blob);
    var link = document.getElementById("save");
    link.href = url;
    link.download = filename || 'output.wav';
  }

  window.Recorder = Recorder;
  

})(window);
