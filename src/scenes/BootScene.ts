import Phaser from 'phaser';
import { generateAllArt, registerAnimations } from '../assets/generateArt';
import towerBaseImg from '../assets/sprites/tower_base.png';
import arrowBase1Img from '../assets/sprites/arrow_base_1.png';
import arrowBase2Img from '../assets/sprites/arrow_base_2.png';
import cannonBaseImg from '../assets/sprites/cannon_base.png';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.image('t_base_png', towerBaseImg);
    this.load.image('t_base_1_png', arrowBase1Img);
    this.load.image('t_base_2_png', arrowBase2Img);
    this.load.image('c_base_png', cannonBaseImg);
  }

  create() {
    generateAllArt(this);
    registerAnimations(this);
    this.scene.start('Game', { playerName: (window as any).__playerName || 'hero' });
    this.scene.launch('UI');
  }
}
