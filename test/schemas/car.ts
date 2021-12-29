import {Schema, model} from 'mongoose';

export interface ICar {
	name: string;
}

const carSchema = new Schema<ICar>({
	name: {type: String, required: true},
});

export const Car = model('car', carSchema);
