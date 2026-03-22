declare module "qrcode-terminal" {
  export interface GenerateOptions {
    small?: boolean;
  }

  export interface QRCodeTerminal {
    generate(input: string, options?: GenerateOptions, callback?: (qrcode: string) => void): void;
  }

  const qrcodeTerminal: QRCodeTerminal;
  export default qrcodeTerminal;
}
