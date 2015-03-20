/* global PIXI,_,Q */
var FACE_URL = "face.png",
    GRAVITY = -0.15,
    NUMBER_FACES = 8,
    FACE_SCALE = 5,
    MAX_ROTATION = 0.03,
    EIGTH_NOTE = 320,
    NUMBER_KEYS = 5,
    WAVE_TYPES = [
        "sine",
        "square",
        "sawtooth"
    ],
    ROOTS = [
        261.63,
        293.66,
        329.63,
        349.23,
        392.00,
        440.00,
        493.88,
        523.25,
        587.33
    ];

var stage = new PIXI.Stage(0xFFFFFF, true),
    renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight, {
        antialias: false
    }),
    container = new PIXI.DisplayObjectContainer(),
    faceTexture,
    faces,
    faceSprite,
    rndm = Math.random,
    AudioContext = window.AudioContext || window.webkitAudioContext,
    audioCtx = new AudioContext(),
    listener = audioCtx.listener,
    reverb = audioCtx.createConvolver(),
    masterGain = audioCtx.createGain(),
    roots = cycle(ROOTS),
    waveTypes = cycle(WAVE_TYPES),
    scaleDegrees = cycle([0, 1, 2, 3, 4]),
    rhythm = cycle([
        1, 0, 0, 0,
        1, 0, 0, 0,
        1, 0, 1, 0,
        1, 0, 0, 0
    ]),
    instrumentPool,
    scale,
    launchCounter = 0,
    instrumentQueue,
    bottomKeyboard = keyboard(),
    textMarquee = document.getElementById("text-marquee"),
    muteButton = document.getElementById("mute"),
    musicState = {
        init: function init () {
            this.nextScale();
            this.shape = cycle([0, 1, 2, 3, 4]);
            this.scale = pentatonicScale(roots.next());
            return this;
        },
        currentPitch: function currentPitch () {
            return this.scale[this.shape.current()];
        },
        currentDegree: function currentDegree () {
            return this.shape.current();
        },
        nextPitch: function nextPitch () {
            this.shape.next();
            return this.currentPitch();
        },
        nextScale: function nextScale () {
            this.scale = pentatonicScale(roots.next());
            return this;
        },
        shuffle: function shuffle () {
            this.shape.shuffle();
        }
    }.init();

// get assets then call init
Q.all([getBuffer(), getFace()]).then(function () {
    console.log("got buffer and face");
    init();
}, function () {
    console.error("error initializing");
});


function init () {
    instrumentPool = cycle(_.times(NUMBER_FACES * 2, instrument));
    instrumentPool.play = function play (face) {
        this.next().playFace(face);
    };

    muteButton.addEventListener("click", toggleSound);

    reverb.connect(masterGain);
    masterGain.connect(audioCtx.destination);
    masterGain.gain.value = 1;

    faces = _.times(NUMBER_FACES, face);

    renderer.view.style.position = "absolute";
    window.addEventListener("resize", resizeStage);
    document.body.appendChild(renderer.view);
    stage.addChild(container);
    renderer.render(stage);
    _.each(_.pluck(faces, "sprite"), container.addChild.bind(container));

    setInterval(tryLaunchingFace, EIGTH_NOTE);

    loop();
    console.log("started main loop");
}


function loop () {
    _.invoke(faces, "update");
    renderer.render(stage);
    requestAnimationFrame(loop);
}


// objects


function cycle (array) {
    return {
        init: function init () {
            this.array = array;
            this.index = 0;
            return this;
        },
        current: function current () {
            return this.array[this.index];
        },
        next: function next () {
            this.index++;
            this.index %= this.array.length;
            return this.current();
        },
        shuffle: function shuffle () {
            var currentIndex = this.array.length,
                temporaryValue,
                randomIndex;

            while (currentIndex !== 0) {
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex -= 1;
                temporaryValue = this.array[currentIndex];
                this.array[currentIndex] = this.array[randomIndex];
                this.array[randomIndex] = temporaryValue;
            }
        },
        permuteTwo: function permuteTwo () {
            var betweenN = randomInt.bind(null, 0, this.array.length),
                one = betweenN(),
                two = betweenN(),
                temp;
            while (one === two) {
                two = betweenN();
            }
            temp = this.array[one];
            this.array[one] = this.array[two];
            this.array[two] = temp;
        }
    }.init();
}


function instrument () {
    return {
        init: function init () {
            this.osc = audioCtx.createOscillator();
            this.osc_oct = audioCtx.createOscillator();
            this.osc_fifth = audioCtx.createOscillator();
            this.panner = audioCtx.createPanner();
            this.gain = audioCtx.createGain();
            this.osc.connect(this.panner);
            this.osc_oct.connect(this.panner);
            this.osc_fifth.connect(this.panner);
            this.panner.connect(this.gain);
            this.gain.connect(reverb);
            this.gain.gain.value = 0;
            this.panner.panningModel = "equalpower";
            this.osc.start(0);
            this.osc_oct.start(0);
            this.osc_fifth.start(0);
            return this;
        },
        noteOn: function noteOn (velocity) {
            this.gain.gain.value = velocity; // linear ramp causes audible pop
        },
        noteOff: function noteOff () {
            this.gain.gain.value = 0; // linear ramp causes audible pop
        },
        playNote: function playNote (pitch, duration) {
            this.osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
            this.osc_oct.frequency.setValueAtTime(pitch * 2, audioCtx.currentTime);
            this.osc_fifth.frequency.setValueAtTime(pitch * halfSteps(7), audioCtx.currentTime);
            this.noteOn(1);
            setTimeout(this.noteOff.bind(this), duration * 1000);
        },
        playFace: function playFace (face) {
            var x = 10 * (face.sprite.x / window.innerWidth - 0.5),
                y = 0,
                z = 10 - Math.abs(x);
            this.panner.setPosition(x, y, z);
            this.osc.type = waveTypes.current();
            this.osc_oct.type = waveTypes.current();
            this.osc_fifth.type = waveTypes.current();
            this.playNote(musicState.nextPitch(), 0.25);
            bottomKeyboard.keypress(musicState.currentDegree(), 100);
        }
    }.init();
}


function face () {
    return {
        init: function init () {
            this.sprite = new PIXI.Sprite(faceTexture);
            this.sprite.width /= FACE_SCALE;
            this.sprite.height /= FACE_SCALE;
            this.sprite.pivot.x = this.sprite.width / 2;
            this.sprite.pivot.y = this.sprite.height / 2;
            this.sprite.alpha = 1;
            this.sprite.y = belowViewport();
            this.isDone = true;
            this.beenInView = false;
            this.speed = {};
            return this;
        },
        makeSound: function makeSound () {
            instrumentPool.play(this);
        },
        reset: function reset () {
            this.sprite.alpha = 1;
            this.beenInView = false;
            this.isDone = false;
            this.sprite.y = belowViewport();
            this.speed.x = randomSpeedX();
            this.speed.y = randomSpeedY();
            this.speed.rotation = randomRotation();
            this.makeSound(); 
            this.sprite.x = scaleDegreeX();
        },
        isBelowViewport: function isBelowViewport () {
            return this.sprite.y >= belowViewport();
        },
        update: function update () {
            if (this.isDone || (this.isBelowViewport() && this.beenInView)) {
                this.isDone = true;
                return;
            }
            this.sprite.alpha -= 0.008;
            this.speed.y += GRAVITY;
            this.sprite.x += this.speed.x;
            this.sprite.y -= this.speed.y;
            this.sprite.rotation += this.speed.rotation;
            if (!this.isBelowViewport()) {
                this.beenInView = true;
            }
        }
    }.init();
}

function keyboard () {
    return {
        init: function init () {
            // make dom elements
            // listen for launch events
            this.colors = [
                "rgba(191, 63, 63, 0.8)",
                "rgba(191, 191, 63, 0.8)",
                "rgba(63, 191, 63, 0.8)",
                "rgba(63, 191, 191, 0.8)",
                "rgba(63, 63, 191, 0.8)"
            ];
            this.keys = [];
            _.times(NUMBER_KEYS, function (i) {
                var key = document.createElement("div"),
                    width = (1 / NUMBER_KEYS) * 100,
                    left = width * i;

                key.defaultCssArray = [
                    "position: absolute;",
                    "transition: all 0.6s ease;",
                    "height: 40px;",
                    "width: " + width + "%;",
                    "left: " + left + "%;",
                    "top: calc(100% - 5px);",
                    "background: " + this.colors[i] + ";",
                    "z-index: 2;"
                ];
                key.pressedCssArray = [
                    "position: absolute;",
                    "height: 50px;",
                    "width: " + (width + 2) + "%;",
                    "left: " + (left - 1) + "%;",
                    "top: calc(100% - 40px);",
                    "background: " + this.colors[i] + ";",
                    "z-index: 2;"
                ];
                setCss(key, key.defaultCssArray);
                document.body.appendChild(key);
                this.keys.push(key);
            }, this);
            return this;
        },
        keypress: function (index, duration) {
            var key = this.keys[index];
            setCss(key, key.pressedCssArray);
            setTimeout(function () {
                setCss(key, key.defaultCssArray);
            }, duration);
        }
    }.init();
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


function randomSpeedX () {
    return (window.innerWidth / 850) * (rndm() - 0.5);
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


function randomInt (low, high) {
    // doesn't include high
    return Math.floor(rndm() * (high - low)) + low;
}


function halfSteps (steps) {
    return Math.pow(1.05945716108, steps);
}


function pentatonicScale (root) {
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


function tryLaunchingFace () {
    if (freeFaces().length > 0) {
        if (rhythm.next()) {
            freeFaces()[0].reset();   
            launchCounter++;
            changeThings(launchCounter);
        }
    }
}


function changeThings (i) {
    var loopLength = 5;
    if (i % (loopLength * 3) === 0) {
        musicState.nextScale();
        musicState.shape.permuteTwo();
    }
    if (i % loopLength === 0) {
        rhythm.permuteTwo();
    }
}


function muteSound () {
    masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
}


function unmuteSound () {
    masterGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.1);
}


function resizeStage () {
    renderer.resize(window.innerWidth, window.innerHeight);
}


function freeFaces () {
    return _.filter(faces, function (face) {
        return face.isDone;
    }); 
}


function scaleDegreeX () {
    var x = (window.innerWidth / musicState.scale.length) * musicState.currentDegree();
    x += window.innerWidth / (musicState.scale.length * 2);
    return x;
}


function setCss (node, styles) {
    node.style.cssText = styles.join("");
}
