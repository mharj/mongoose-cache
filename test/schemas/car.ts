import {type HydratedDocument, model, Schema} from 'mongoose';

export interface ICar {
	name: string;
}

const carSchema = new Schema<ICar>({
	name: {type: String, required: true},
});

export type CarDocument = HydratedDocument<ICar>;

export const CarModel = model('car', carSchema);
