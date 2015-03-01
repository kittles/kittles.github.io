/* global PIXI,_ */
var stage = new PIXI.Stage(0xFFFFFF, true),
    renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight, {
        antialias: false
    }),
    container = new PIXI.DisplayObjectContainer(),
    faceTexture = new PIXI.Texture.fromImage("face.png"),
    faces,
    faceSprite,
    rndm = Math.random,
    GRAVITY = -0.15,
    NUMBER_FACES = 15,
    FACE_SCALE = 5,
    CHANGE_SCALE_TIMEOUT = 8000,
    MAX_ROTATION = 0.03,
    AudioContext = window.AudioContext || window.webkitAudioContext,
    audioCtx = new AudioContext(),
    listener = audioCtx.listener,
    reverb = audioCtx.createConvolver(),
    waveTypes = [
        "sine",
        "square",
        "sawtooth"
    ],
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
    bufferRequest,
    instrumentQueue,
    textMarquee = document.getElementById("text-marquee");

// position listener for panning
listener.setPosition(0, 0, 0, 0, 0, 0);

// pixi canvas resizing handler
renderer.view.style.position = "absolute";
window.addEventListener("resize", function () {
    renderer.resize(window.innerWidth, window.innerHeight);
});

// make instrument queue
instrumentQueue = {
    index: -1,
    queueSize: NUMBER_FACES * 2,
    queue: _.times(NUMBER_FACES * 2, newInstrument),
    play: function play (face) {
        this.index++;
        this.index %= this.queueSize;
        this.queue[this.index].play(face);
    }
};

// change the root of the scale every so often
// change the background color too
setScale();
setInterval(function () {
    setScale();
    changeBackgroundColor();
}, CHANGE_SCALE_TIMEOUT);

// get reverb impulse response
bufferRequest = new XMLHttpRequest();
bufferRequest.open("GET", "reverb.wav", true);
bufferRequest.responseType = "arraybuffer";
bufferRequest.onload = onbufferload;
function onbufferload () {
    audioCtx.decodeAudioData(bufferRequest.response, ondecodesuccess, ondecodeerror);
}
function ondecodesuccess (buffer) {
    reverb.buffer = buffer;
    reverb.connect(audioCtx.destination);
    start();
} 
function ondecodeerror (e) {
    "Error with decoding audio data" + e.err;
}
bufferRequest.send();

// constructors
function Instrument () {
    this.osc = audioCtx.createOscillator();
    this.panner = audioCtx.createPanner();
    this.gain = audioCtx.createGain();
    this.osc.connect(this.panner);
    this.panner.connect(this.gain);
    this.gain.connect(reverb);
    this.gain.gain.value = 0;
    this.panner.panningModel = "equalpower";
    this.osc.type = randomChoice(waveTypes);
    this.osc.start();
    this.play = function play (face) {
        var x = 10 * (face.sprite.x / window.innerWidth - 0.5),
            y = 0,
            z = 10 - Math.abs(x);
        this.osc.frequency.setValueAtTime(randomChoice(scale), audioCtx.currentTime);
        this.panner.setPosition(x, y, z);
        this.gain.gain.setValueAtTime(face.speed.y / 3, audioCtx.currentTime);
        this.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
    };
}
function Face () {
    this.sprite = new PIXI.Sprite(faceTexture);
    this.sprite.width /= FACE_SCALE;
    this.sprite.height /= FACE_SCALE;
    this.sprite.pivot.x = this.sprite.width / 2;
    this.sprite.pivot.y = this.sprite.height / 2;
    this.speed = {};
    this.playNote = function playNote () {
        instrumentQueue.play(this);
    };
    this.reset = function reset () {
        this.sprite.x = randomPositionX();
        this.sprite.y = belowViewport();
        this.speed.x = randomSpeedX();
        this.speed.y = randomSpeedY();
        this.speed.rotation = randomRotation();
        this.playNote();
    };
    this.reset();
    this.update = function update () {
        if (this.sprite.y > belowViewport()) {
            this.reset();
        } else {
            this.speed.y += GRAVITY;
            this.sprite.x += this.speed.x;
            this.sprite.y -= this.speed.y;
            this.sprite.rotation += this.speed.rotation;
        }
    };
}
// rendering
function start () {
    faces = _.times(NUMBER_FACES, newFace);
    _.each(_.pluck(faces, "sprite"), container.addChild.bind(container));
    container.addChild(faces[0].sprite);
    document.body.appendChild(renderer.view);
    stage.addChild(container);
    loop();
}
function loop () {
    _.invoke(faces, "update");
    renderer.render(stage);
    requestAnimationFrame(loop);
}
// utility
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
    return [
        root,
        root * Math.pow(1.05945716108, 2),
        root * Math.pow(1.05945716108, 4),
        root * Math.pow(1.05945716108, 7),
        root * Math.pow(1.05945716108, 9)
    ];
}
function setScale () {
    scale = pentatonicScale(randomChoice(roots));
}
function changeBackgroundColor () {
    textMarquee.style.backgroundColor = "rgba(" + _.random(0, 255) + "," + _.random(0, 255) + "," + _.random(0, 255) + ", 0.5)";
}
