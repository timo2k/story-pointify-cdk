import { Payload } from './payload.model';
import { Status } from './status.enum';

export class StatusChangeEvent extends Payload {
  constructor(init?: Partial<StatusChangeEvent>) {
    super('StatusChangeEvent');
    Object.assign(this, init);
  }

  public userId!: string;
  public currentStatus!: Status;
  public eventDate!: Date;
}
