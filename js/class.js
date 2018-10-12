function genGame(passwd, gameObj) {
	class Screen {
		constructor(objperso) {
			this.me = objperso;
			this.ctx = document.getElementById('canvas').getContext("2d");
			this.rough = rough.canvas(document.getElementById('canvas'));
			this.persos = [];
			this.actionBuffer = [];
			this.frames = 0;
			this.refreshInterval = function() {
				setInterval(() => {

					if (this.actionBuffer.length !== 0) {
						if (this.frames % 5 === 0) {
							this.process(this.actionBuffer[0]);
							this.actionBuffer.shift();
						}
					}

					let coefX = (window.innerWidth / 2) - 225;
					let coefY = (window.innerHeight / 2) - 225;
					document.getElementById('canvas').width = window.innerWidth;
					document.getElementById('canvas').height = window.innerHeight;

					this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
					this.ctx.strokeStyle = "white";
					this.ctx.fillStyle = "white";
					this.ctx.font = '35px serif';

					for (let i = 0; i < 9; i++) {
						this.ctx.fillText("" + i, (coefX + 17) + i * 50, coefY + 37 - 50);
						this.ctx.fillText("" + i, (coefX + 17 - 50), (coefY + 37) + i * 50);
					}

					for (let i = 0; i < 10; i++) {
						this.ctx.beginPath();
						this.ctx.moveTo(0 + coefX, i * 50 + coefY);
						this.ctx.lineTo(9 * 50 + coefX, i * 50 + coefY);
						this.ctx.stroke();
					}

					for (let x = 0; x < 10; x++) {
						this.ctx.beginPath();
						this.ctx.moveTo(x * 50 + coefX, 0 + coefY);
						this.ctx.lineTo(x * 50 + coefX, 9 * 50 + coefY);
						this.ctx.stroke();
					}

					this.rough.rectangle(this.me.x * 50 + coefX, this.me.y * 50 + coefY, 50, 50, {
						fill: this.me.color,
						stroke: "white",
						fillStyle: "cross-hatch"
					}); // x, y, width, height

					for (let i = 0; i < this.persos.length; i++) {
						this.rough.rectangle(this.persos[i].x * 50 + coefX, this.persos[i].y * 50 + coefY, 50, 50, {
							fill: this.persos[i].color,
							stroke: "white",
							fillStyle: "cross-hatch"
						}); // x, y, width, height
					}

					socket.emit("getUpdate", cryptico.encryptAESCBC(passwd, AESKEY));

					this.frames++;
				}, 50);
			}
		}
		process(obj) {
			switch (obj.instruct) {
				case "newPos":
					if (typeof(obj.x) === "number" && typeof(obj.y) === "number") {
						if (obj.x < 9 && obj.x >= 0 && obj.y < 9 && obj.y >= 0 && Number.isInteger(obj.x) && Number.isInteger(obj.y)) {
							this.me.x = obj.x;
							this.me.y = obj.y;
						} else {
							console.log("Sapristi, la valeur que vous avez entré n'est pas valable !");
						}
					} else {
						console.log("Sapristi, la valeur que vous avez entré n'est pas valable !");
					}
					break;
				case "move":
					switch (obj.dir) {
						case "up":
							if (this.me.y > 0) {
								this.me.y--;
							} else {
								this.me.y = 8;
							}
							break;
						case "down":
							if (this.me.y < 8) {
								this.me.y++;
							} else {
								this.me.y = 0;
							}
							break;
						case "right":
							if (this.me.x < 8) {
								this.me.x++;
							} else {
								this.me.x = 0;
							}
							break;
						case "left":
							if (this.me.x > 0) {
								this.me.x--;
							} else {
								this.me.x = 8;
							}
							break;
					}
					break;
			}
			socket.emit("myPos", this.me, cryptico.encryptAESCBC(passwd, AESKEY));
		}
	}

	class Personnage {
		constructor(x, y, name) {
			this.name = name;
			this.x = x;
			this.y = y;
			this.color = "white";
			this.wolf = false;
		}
	}

	const scr = new Screen(gameObj);
	let bol = true;


	const game = function(obj, key) {
		if (bol) {
			console.log("^^")
			scr.refreshInterval();
			bol = false;
		}
		if (obj.instruct === "getAuth") {
			return new Hashes.SHA256().b64(passwd);
		} else if (obj.instruct === "mypos") {
			return {
				x: scr.me.x,
				y: scr.me.y
			};
		}
		if (key === passwd) {
			if (obj.instruct === "players") {
				for (let i = 0; i < obj.players.length; i++) {
					scr.persos.push(new Personnage(obj.players[i].x, obj.players[i].y, obj.players[i].name));
				}
			} else if (obj.instruct === "new") {
				scr.persos.push(new Personnage(obj.perso.x, obj.perso.y, obj.perso.name));
			} else if (obj.instruct === "update") {
				for (let i = 0; i < obj.players.length; i++) {
					for (let x = 0; x < scr.persos.length; x++) {
						if (obj.players[i].name === scr.persos[x].name) {
							scr.persos[x].x = obj.players[i].x;
							scr.persos[x].y = obj.players[i].y;
							scr.persos[x].wolf = obj.players[i].wolf;
							if (scr.persos[x].wolf) {
								scr.persos[x].color = "red";
								if (scr.me.x === scr.persos[x].x && scr.me.y === scr.persos[x].y) {
									window.location.reload();
								}
							} else {
								scr.persos[x].color = "white";
							}
						}
					}
				}
			} else if (obj.instruct === "bye") {
				// finir sa !
				console.log(obj.user + " est parti !")
				for (let i = 0; i < scr.persos.length; i++) {
					if (scr.persos[i].name === obj.user) {
						scr.persos.splice(i, 1);
					}
				}
			} else {
				scr.actionBuffer.push(obj);
			}

		}
	}
	return game;
}