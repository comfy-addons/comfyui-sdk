export class QuietRenderer {
  render(result: any): void {
    console.log(JSON.stringify(result, null, 2));
  }

  onFailed(err: Error): void {
    console.error(err.message);
  }

  onConnect(): void {}

  onPending(_promptId: string): void {}

  onProgress(_info: any): void {}

  onOutput(_key: string): void {}

  onFinished(_result: any): void {}

  info(_msg: string): void {}

  blank(): void {}
}
