import Phaser from 'phaser';
import towerBaseImg from '../assets/sprites/tower_base.png';
import arrowBase1Img from '../assets/sprites/arrow_base_1.png';
import arrowBase2Img from '../assets/sprites/arrow_base_2.png';
import cannonBaseImg from '../assets/sprites/cannon_base.png';
import cannonBase1Img from '../assets/sprites/cannon_base_1.png';
import cannonBase2Img from '../assets/sprites/cannon_base_2.png';
import levelMapBgImg from '../assets/sprites/level_map_bg.jpg';
import greenCheckImg from '../assets/sprites/green_check.png';
import { SFX } from '../audio/sfx';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.image('t_base_png', towerBaseImg);
    this.load.image('t_base_1_png', arrowBase1Img);
    this.load.image('t_base_2_png', arrowBase2Img);
    this.load.image('c_base_png', cannonBaseImg);
    this.load.image('c_base_1_png', cannonBase1Img);
    this.load.image('c_base_2_png', cannonBase2Img);
    this.load.image('level_map_bg', levelMapBgImg);
    this.load.image('green_check', greenCheckImg);

  }

  create() {
    // Synchronous unlock happens in main.ts on the Play click. This kicks off
    // async fetch+decode of all audio assets so they're ready by gameplay.
    SFX.loadAssets();
    // Art generation deferred to GameScene — go straight to level select
    this.scene.start('LevelSelect');
  }
}
