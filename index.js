/* global PIXI,_ */
var stage = new PIXI.Stage(0xFFFFFF, true);
var renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight, {
        antialias: false
    });
var container = new PIXI.DisplayObjectContainer();
var faceSprite;
var face = new PIXI.Texture.fromImage("face.png");
var gravity = -0.15;
var faces = [];

function resetSprite (sprite) {
}

function start () {
    document.body.appendChild(renderer.view);
    stage.addChild(container);

    for (var i = 0; i < 20; i++) {
        faceSprite = new PIXI.Sprite(face);
        faceSprite.width /= 5;
        faceSprite.height /= 5;
        faceSprite.pivot.x = faceSprite.width / 2;
        faceSprite.pivot.y = faceSprite.height / 2;
        faceSprite.x = Math.random() * window.innerWidth;
        faceSprite.y = window.innerHeight + 100;
        faceSprite.speed = {};
        faceSprite.speed.x = 7 * (Math.random() - 0.5);
        faceSprite.speed.y = 9 + Math.random() * 4;
        faceSprite.speed.rotation = 0.03 * (Math.random() - 0.5);
        resetSprite(faceSprite);
        faces.push(faceSprite);
        container.addChild(faceSprite);
    }

    loop();
}
setTimeout(start, 1000);

renderer.view.style.position = "absolute";
window.addEventListener("resize", function () {
    renderer.resize(window.innerWidth, window.innerHeight);
});


function loop () {
    _.each(faces, function (faceSprite) {
        faceSprite.rotation += faceSprite.speed.rotation;
        faceSprite.speed.y += gravity;
        faceSprite.x += faceSprite.speed.x;
        faceSprite.y -= faceSprite.speed.y;

        if (faceSprite.y > window.innerHeight + 100) {
            faceSprite.x = Math.random() * window.innerWidth;
            faceSprite.y = window.innerHeight + 100;
            faceSprite.speed.x = 7 * (Math.random() - 0.5);
            faceSprite.speed.y = 9 + Math.random() * 4;
            faceSprite.speed.rotation = 0.03 * (Math.random() - 0.5);
        }
    });
    renderer.render(stage);
    requestAnimationFrame(loop);
}
