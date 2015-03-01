/* global PIXI,_,Q */
var stage = new PIXI.Stage(0xFFFFFF, true),
    renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight, {
        antialias: false
    }),
    container = new PIXI.DisplayObjectContainer(),
    FACE_URL = "face.png",
    faceTexture,
    faces,
    faceSprite,
    rndm = Math.random,
    GRAVITY = -0.15,
    NUMBER_FACES = 8,
    FACE_SCALE = 5,
    CHANGE_STUFF_TIMEOUT = 8000,
    MAX_ROTATION = 0.03,
    EIGTH_NOTE = 200,
    AudioContext = window.AudioContext || window.webkitAudioContext,
    audioCtx = new AudioContext(),
    listener = audioCtx.listener,
    reverb = audioCtx.createConvolver(),
    masterGain = audioCtx.createGain(),
    waveTypes = [
        "sine",
        "square",
        "sawtooth"
    ],
    waveType,
    roots = [
        261.63,
        293.66,
        329.63,
        349.23,
        392.00,
        440.00,
        493.88,
        523.25,
        587.33,
        659.25,
        698.46,
        783.99,
        880.00,
        987.77
    ],
    scale,
    shape,
    instrumentQueue,
    shuffleCounter = 0,
    waveTypeCounter = 0,
    textMarquee = document.getElementById("text-marquee"),
    muteButton = document.getElementById("mute");

// get assets then call init
Q.all([getBuffer(), getFace()]).then(function () {
    init();
}, function () {
    console.error("error initializing");
});
function init () {
    muteButton.addEventListener("click", toggleSound);
    masterGain.connect(audioCtx.destination);
    masterGain.gain.setValueAtTime(1, audioCtx.currentTime);
    listener.setPosition(0, 0, 0, 0, 0, 0);
    shape.shuffleShape();
    setScale();
    setWaveType();
    setInterval(changeStuff, CHANGE_STUFF_TIMEOUT);
    faces = _.times(NUMBER_FACES, newFace);
    renderer.view.style.position = "absolute";
    window.addEventListener("resize", resizeStage);
    document.body.appendChild(renderer.view);
    stage.addChild(container);
    renderer.render(stage);
    _.each(_.pluck(faces, "sprite"), container.addChild.bind(container));
    setInterval(tryLaunchingFace, EIGTH_NOTE);
    loop();
}
function loop () {
    _.invoke(faces, "update");
    renderer.render(stage);
    requestAnimationFrame(loop);
}

// objects and constructors
shape = {
    index: -1,
    shape: [0, 1, 2, 3, 4],
    shuffle: function shuffle (o) {
        for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x) {
            _.noop();   
        }
        return o;
    },
    next: function next () {
        this.index++;
        this.index %= this.shape.length;
        return this.shape[this.index];
    },
    shuffleShape: function shuffleShape () {
        this.shuffle(this.shape);
    }
};
instrumentQueue = {
    index: -1,
    queueSize: NUMBER_FACES * 2,
    queue: _.times(NUMBER_FACES * 2, newInstrument),
    play: function play (face) {
        this.index++;
        this.index %= this.queueSize;
        this.queue[this.index].playFace(face);
    }
};
function Instrument () {
    this.osc = audioCtx.createOscillator();
    this.panner = audioCtx.createPanner();
    this.gain = audioCtx.createGain();
    this.osc.connect(this.panner);
    this.panner.connect(this.gain);
    this.gain.connect(reverb);
    this.gain.gain.value = 0;
    this.panner.panningModel = "equalpower";
    this.osc.start();
    this.noteOn = function noteOn (velocity) {
        this.gain.gain.linearRampToValueAtTime(velocity, audioCtx.currentTime + 0.2);
    };
    this.noteOff = function noteOff (decay) {
        this.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + decay);
    };
    this.playFace = function playFace (face) {
        this.osc.type = waveType;
        var x = 10 * (face.sprite.x / window.innerWidth - 0.5),
            y = 0,
            z = 10 - Math.abs(x);
        this.osc.frequency.setValueAtTime(getNextPitch(), audioCtx.currentTime);
        this.panner.setPosition(x, y, z);
        setTimeout(this.noteOn.bind(this, face.speed.y / 3), 10);
        setTimeout(this.noteOff.bind(this, 1), 210);
    };
}
function Face () {
    this.sprite = new PIXI.Sprite(faceTexture);
    this.sprite.width /= FACE_SCALE;
    this.sprite.height /= FACE_SCALE;
    this.sprite.pivot.x = this.sprite.width / 2;
    this.sprite.pivot.y = this.sprite.height / 2;
    // initialize below viewport
    this.sprite.y = belowViewport();
    this.isDone = true;
    this.beenInView = false;
    this.speed = {};
    this.playNote = function playNote () {
        instrumentQueue.play(this);
    };
    this.reset = function reset () {
        this.beenInView = false;
        this.isDone = false;
        this.sprite.x = randomPositionX();
        this.sprite.y = belowViewport();
        this.speed.x = randomSpeedX();
        this.speed.y = randomSpeedY();
        this.speed.rotation = randomRotation();
        this.playNote();
    };
    //this.reset();
    this.isBelowViewport = function isBelowViewport () {
        return this.sprite.y >= belowViewport();
    };
    this.update = function update () {
        // need to differentiate between faces that have been in 
        // view already, and those that are offscreen but will be in 
        // view shortly
        if (this.isDone) {
            return;
        }
        if (this.isBelowViewport()) {
            if (this.beenInView === true) {
                // could have just finished
                this.isDone = true;
                return;
            } else {
                // could be starting
                _.noop();
            }
        }
        this.speed.y += GRAVITY;
        this.sprite.x += this.speed.x;
        this.sprite.y -= this.speed.y;
        this.sprite.rotation += this.speed.rotation;
        if (!this.isBelowViewport()) {
            this.beenInView = true;
        }
    };
}
// utility functions
function getBuffer (opts) {
    var deferred = Q.defer(),
        bufferRequest = new XMLHttpRequest();

    bufferRequest.open("GET", "reverb.wav", true);
    bufferRequest.responseType = "arraybuffer";
    bufferRequest.onload = onbufferload;
    function onbufferload () {
        audioCtx.decodeAudioData(bufferRequest.response, ondecodesuccess, ondecodeerror);
    }
    function ondecodesuccess (buffer) {
        reverb.buffer = buffer;
        reverb.connect(masterGain);
        deferred.resolve();
    } 
    function ondecodeerror (e) {
        deferred.reject(new Error("Error with decoding audio data" + e.err));
    }
    bufferRequest.send();
    return deferred.promise;
}
function getFace () {
    var deferred = Q.defer(),
        image = document.createElement("img"),
        baseTexture;

    image.addEventListener("load", function onimageload () {
        baseTexture = new PIXI.BaseTexture(image);
        baseTexture.imageUrl = FACE_URL;
        PIXI.BaseTextureCache[FACE_URL] = baseTexture;
        faceTexture = new PIXI.Texture.fromImage("face.png"),
        PIXI.TextureCache[FACE_URL] = faceTexture;
        deferred.resolve();
    });
    image.src = FACE_URL;
    return deferred.promise;
}
function newFace () {
    return new Face();
}
function newInstrument () {
    return new Instrument();
}
function randomSpeedX () {
    return (window.innerWidth / 150) * (rndm() - 0.5);
}
function randomSpeedY () {
    return (window.innerHeight / 90) + (rndm() * 7);
}
function randomPositionX () {
    return rndm() * window.innerWidth;
}
function randomRotation () {
    return MAX_ROTATION * (rndm() - 0.5);
}
function belowViewport () {
    return window.innerHeight + 77; // should get the height based on face scale
}
function randomChoice (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function pentatonicScale (root) {
    var halfSteps = Math.pow.bind(null, 1.05945716108);
    return [
        root,
        root * halfSteps(2),
        root * halfSteps(4),
        root * halfSteps(7),
        root * halfSteps(9)
    ];
}
function setScale () {
    scale = pentatonicScale(randomChoice(roots));
}
function setWaveType () {
    waveTypeCounter++;
    waveTypeCounter %= waveTypes.length;
    waveType = waveTypes[waveTypeCounter];
}
function changeBackgroundColor () {
    var rc = _.random.bind(null, 0, 255);
    textMarquee.style.backgroundColor = "rgba(" + rc() + "," + rc() + "," + rc() + ", 0.5)";
}
function toggleSound () {
    var idx = _.indexOf(muteButton.classList, "muted");
    if (idx > -1) {
        muteButton.classList.remove("muted");
        unmuteSound();
    } else {
        muteButton.classList.add("muted");
        muteSound();
    }
}
function muteSound () {
    masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
}
function unmuteSound () {
    masterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.1);
}
function getNextPitch () {
    return scale[shape.next()];
}
function changeStuff () {
    setScale();
    setWaveType();
    changeBackgroundColor();
    shuffleCounter++;
    shuffleCounter %= 4;
    if (shuffleCounter === 3) {
        shape.shuffleShape();
    }
}
function resizeStage () {
    renderer.resize(window.innerWidth, window.innerHeight);
}
function freeFaces () {
    return _.filter(faces, function (face) {
        return face.isDone;
    }); 
}
function tryLaunchingFace () {
    if (freeFaces().length > 0) {
        if (Math.random() > 0.5) {
            freeFaces()[0].reset();   
        }
    }
}
