import { Status } from './status.enum';

export class User {
  constructor(init?: Partial<User>) {
    Object.assign(this, init);
  }
  public username!: string;
  public status!: Status;
}
