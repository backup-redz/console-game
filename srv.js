const http = require('http');
const fs = require('fs');
const path = require('path');
const MongoClient = require('mongodb').MongoClient;
const url = "mongodb://localhost:27017/";

const getAES32KeyFromString = function(str) {
    const arr = [];
    for (let i = 0; i < 32; i++) {
        let num = str.charCodeAt(i % str.length);
        while (num > 255) {
            num -= 42;
        }
        arr.push(num);
    }
    return arr;
}

MongoClient.connect(url, {
    useNewUrlParser: true
}, function(err, db) {
    if (err) throw err;
    var dbo = db.db("consolegame");


    function entierAleatoire(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // cryptage library
    const cryptico = require("cryptico");
    const Hashes = require('jshashes');
    //new Hashes.SHA256().b64("salut") // how to SHA256 ;)
    function genString(len) {
        const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789^ù!:;,?./%$£*µ&é(-è_çà)=+°@|[{#";
        let securestring = "";
        for (let i = 0; i < len; i++) {
            securestring += alphabet.charAt(entierAleatoire(0, alphabet.length));
        }
        return securestring;
    }
    const PRIVATE_KEY = cryptico.generateRSAKey(genString(100), 1024);
    const PUBLIC_KEY = cryptico.publicKeyString(PRIVATE_KEY);


    const redirPaths = [{
        name: "error.css",
        dir: "./error.css"
    }, {
        name: "srv",
        dir: "./403.html"
    }];
    //const myIp = "172.19.220.69";
    const myIp = "192.168.43.51";
    //const myIp = "localhost";
    const myPort = 8000;
    const connectes = [];
    const temporaryTokens = [];

    const server = http.createServer(handler);
    const io = require('socket.io')(server);


    function handler(request, response) {

        let filePath = '.' + request.url;
        if (filePath == './') {
            filePath = './index.html';
        }

        for (let i = 0; i < redirPaths.length; i++) {
            let rgx = new RegExp(redirPaths[i].name);
            if (rgx.test(filePath)) {
                filePath = redirPaths[i].dir;
                break;
            }
        }

        let extname = String(path.extname(filePath)).toLowerCase();
        if (extname === "") {
            extname = ".html";
            filePath += "/index.html";
        }
        const mimeTypes = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpg',
            '.gif': 'image/gif',
            '.wav': 'audio/wav',
            '.mp4': 'video/mp4',
            '.woff': 'application/font-woff',
            '.ttf': 'application/font-ttf',
            '.eot': 'application/vnd.ms-fontobject',
            '.otf': 'application/font-otf',
            '.svg': 'application/image/svg+xml'
        };

        const contentType = mimeTypes[extname] || 'application/octet-stream';

        fs.readFile(filePath, function(error, content) {
            if (error) {
                if (error.code == 'ENOENT') {
                    fs.readFile('./404.html', function(error, content) {
                        response.writeHead(200, {
                            'Content-Type': 'text/html'
                        });
                        response.end(content, 'utf-8');
                    });
                } else {
                    response.writeHead(500);
                    response.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
                    response.end();
                }
            } else {
                response.writeHead(200, {
                    'Content-Type': contentType
                });
                response.end(content, 'utf-8');
            }
        });
    }

    server.listen(myPort, myIp);

    io.on('connection', function(socket) {
        function fundamentalVerif(socket) {
            if (socket.hasOwnProperty("token") && socket.hasOwnProperty("user")) {
                return true;
            }
            return false;
        }

        socket.emit('PUBLIC_KEY', PUBLIC_KEY);

        socket.on("createAccount", (obj) => {
            if (obj.hasOwnProperty("user") && obj.hasOwnProperty("passwd")) {
                let userName = cryptico.decrypt(obj.user, PRIVATE_KEY).plaintext;
                let passwd = cryptico.decrypt(obj.passwd, PRIVATE_KEY).plaintext;
                if (userName.length > 30) {
                    socket.emit("log", "Votre nom de compte ne peut dépasser 30 charactères.");
                } else {

                    dbo.collection("connection").findOne({
                        user: userName
                    }, function(err, result) {
                        if (err) throw err;
                        if (result === null) {
                            const myobj = {
                                user: userName,
                                passwd: passwd
                            };
                            dbo.collection("connection").insertOne(myobj, function(err, res) {
                                if (err) throw err;
                                socket.emit("log", "Votre compte à bien été créé ! \n Votre nom d'utilisateur est " + userName + ".");
                            });
                        } else socket.emit("log", "Ce nom d'utilisateur est déjà pris :c");
                    });
                }
            }
        });

        socket.on("login", (obj) => {
            if (!socket.hasOwnProperty("user")) {
                let alreadyUsed = false;
                if (obj.hasOwnProperty("user") && obj.hasOwnProperty("passwd")) {
                    let userName = cryptico.decrypt(obj.user, PRIVATE_KEY).plaintext;
                    dbo.collection("connection").findOne({
                        user: userName
                    }, function(err, result) {
                        if (err) throw err;
                        if (result === null) {
                            socket.emit("log", "Ce nom de compte n'existe pas...\nVous pouvez créer un compte avec la commande : createAccount(userName, passWord)");
                        } else {
                            if (result.passwd === cryptico.decryptAESCBC(obj.passwd, getAES32KeyFromString(result.passwd))) {
                                for (let i = 0; i < connectes.length; i++) {
                                    if (connectes[i].name === userName) {
                                        socket.emit("log", "Une personne est déjà connectée sur ce compte.");
                                        alreadyUsed = true;
                                    }
                                }
                                if (!alreadyUsed) {
                                    socket.user = userName;
                                    socket.AESKEY = getAES32KeyFromString(result.passwd);
                                    socket.token = new Hashes.SHA256().b64(genString(100));
                                    const temp = new Hashes.SHA256().b64(genString(99));
                                    temporaryTokens.push(temp);
                                    socket.emit("log", "Vous êtes bien connecté !");
                                    socket.wolf = false;
                                    const gameObject = {
                                        token: cryptico.encryptAESCBC(socket.token, socket.AESKEY),
                                        x: entierAleatoire(0, 8),
                                        y: entierAleatoire(0, 8),
                                        name: socket.user,
                                        color: "blue",
                                        wolf: socket.wolf
                                    };
                                    socket.emit("startGame", gameObject);
                                    setTimeout(() => {
                                        const tosend = [];
                                        for (let i = 0; i < connectes.length; i++) {
                                            tosend.push({
                                                x: connectes[i].x,
                                                y: connectes[i].y,
                                                name: connectes[i].name,
                                                wolf: false
                                            });
                                        }
                                        socket.emit("instruct", {
                                            instruct: "players",
                                            players: tosend
                                        }, cryptico.encryptAESCBC(socket.token, socket.AESKEY));
                                        setTimeout(() => {
                                            connectes.push({
                                                x: gameObject.x,
                                                y: gameObject.y,
                                                name: socket.user,
                                                id: socket.id,
                                                AESKEY: socket.AESKEY,
                                                token: socket.token,
                                                wolf: socket.wolf
                                            });
                                        }, 50);
                                    }, 50);
                                    socket.broadcast.emit("available", {
                                        x: 4,
                                        y: 4,
                                        name: socket.user,
                                        wolf: false
                                    }, temp);
                                    setTimeout(() => {
                                        temporaryTokens.shift();
                                    }, 500);
                                }
                            } else {
                                socket.emit("log", "Mot de passe incorrect !");
                            }
                        }
                    });
                }
            } else {
                socket.emit("log", "Vous êtes déjà connecté au nom de : " + socket.user + "\nVous pouvez vous déconnecter avec la commande : logout()");
            }
        });

        socket.on("logout", () => {
            if (fundamentalVerif(socket)) {
                for (let i = 0; i < connectes.length; i++) {
                    if (connectes[i].name === socket.user) {
                        connectes.splice(i, 1);
                    }
                }
                socket.emit("logout");
            } else {
                socket.emit("log", "Quelque chose n'a pas fonctionné. Etes-vous vraiment connecté ?");
            }
        });

        socket.on("goto", (pos) => {
            if (fundamentalVerif(socket)) {
                const instrObj = {
                    x: pos.x,
                    y: pos.y,
                    instruct: "newPos"
                };
                socket.emit("instruct", instrObj, cryptico.encryptAESCBC(socket.token, socket.AESKEY));
            } else {
                socket.emit("log", "Quelque chose n'a pas fonctionné. Etes-vous vraiment connecté ?");
            }
        });

        socket.on("move", value => {
            if (fundamentalVerif(socket)) {
                if (value === "up" || value === "down" || value === "right" || value === "left") {
                    socket.emit("instruct", {
                        instruct: "move",
                        dir: value
                    }, cryptico.encryptAESCBC(socket.token, socket.AESKEY));
                }
            } else {
                socket.emit("log", "Quelque chose n'a pas fonctionné. Etes-vous vraiment connecté ?");
            }
        });

        socket.on("disconnect", () => {
            if (fundamentalVerif(socket)) {
                for (let i = 0; i < connectes.length; i++) {
                    if (connectes[i].name === socket.user) {
                        connectes.splice(i, 1);
                    }
                }
                for (let i = 0; i < connectes.length; i++) {
                    io.to(connectes[i].id).emit("instruct", {
                        instruct: "bye",
                        user: socket.user
                    }, cryptico.encryptAESCBC(connectes[i].token, connectes[i].AESKEY));
                }
            }
        });

        socket.on("getNew", (obj, token) => {
            if (fundamentalVerif(socket)) {
                let test = false;
                for (let i = 0; i < temporaryTokens.length; i++) {
                    if (token === temporaryTokens[i]) {
                        test = true;
                    }
                }
                if (test) {
                    obj.wolf = false;
                    socket.emit("instruct", {
                        instruct: "new",
                        perso: obj
                    }, cryptico.encryptAESCBC(socket.token, socket.AESKEY));
                }
            }
        });

        socket.on("myPos", (obj, token) => {
            if (fundamentalVerif(socket)) {
                if (socket.token === cryptico.decryptAESCBC(token, socket.AESKEY)) {
                    for (let i = 0; i < connectes.length; i++) {
                        if (obj.name === connectes[i].name) {
                            connectes[i].x = obj.x;
                            connectes[i].y = obj.y;
                        }
                    }
                }
            }
        });

        socket.on("getUpdate", token => {
            if (fundamentalVerif(socket)) {
                if (socket.token === cryptico.decryptAESCBC(token, socket.AESKEY)) {
                    const tosend = [];
                    for (let i = 0; i < connectes.length; i++) {
                        tosend.push({
                            x: connectes[i].x,
                            y: connectes[i].y,
                            name: connectes[i].name,
                            wolf: connectes[i].wolf
                        });
                    }
                    socket.emit("instruct", {
                        instruct: "update",
                        players: tosend
                    }, cryptico.encryptAESCBC(socket.token, socket.AESKEY));
                    let incr = 0;
                    for (let i = 0; i < connectes.length; i++) {
                        if (connectes[i].wolf) {
                            if (incr !== 0) {
                                connectes[i].wolf = false;
                            }
                            incr++;
                        }
                    }
                    if (incr === 0) {
                        if (connectes.length > 0) {
                            connectes[entierAleatoire(0, connectes.length-1)].wolf = true;
                        }
                    }

                }
            }
        });


    });

    console.log('Server running at http://' + myIp + ':' + myPort + '/');
});