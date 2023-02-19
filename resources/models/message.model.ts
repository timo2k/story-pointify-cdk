import { Payload } from './payload.model';

export class Message extends Payload {
  constructor(init?: Partial<Message>) {
    super('Message');
    Object.assign(this, init);
  }

  public sender!: string;
  public text: string | undefined;
  public sentAt: Date | undefined;
  public roomId!: string;
  public messageId!: string;
}
