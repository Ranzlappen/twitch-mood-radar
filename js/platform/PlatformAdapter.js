/**
 * PlatformAdapter — base class defining the interface for all platform adapters.
 * Concrete adapters (Twitch, YouTube, etc.) must extend this class and implement
 * every method marked "Not implemented".
 */
export class PlatformAdapter {
  constructor() {
    this._onMessageCallback = null;
    this._onStatusCallback = null;
  }

  connect(_channel) { throw new Error('Not implemented'); }
  disconnect() { throw new Error('Not implemented'); }

  onMessage(callback) { this._onMessageCallback = callback; }
  onStatus(callback) { this._onStatusCallback = callback; }

  async loadEmotes(_channelId, _channelName) {}
  async sendMessage(_channel, _msg) { throw new Error('Not implemented'); }

  get isConnected() { return false; }
  get platformName() { return 'unknown'; }
  get platformColor() { return '#ffffff'; }
}
