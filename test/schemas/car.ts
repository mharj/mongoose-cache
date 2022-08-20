import {Schema, model, HydratedDocument} from 'mongoose';

export interface ICar {
	name: string;
}

const carSchema = new Schema<ICar>({
	name: {type: String, required: true},
});

export type CarDocument = HydratedDocument<ICar>;

export const Car = model<ICar>('car', carSchema);
