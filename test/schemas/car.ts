import {Document, Types, Schema, model} from 'mongoose';

export interface ICar {
	name: string;
}

const carSchema = new Schema<ICar>({
	name: {type: String, required: true},
});
export type CarDocument = Document<unknown, any, ICar> &
	ICar & {
		_id: Types.ObjectId;
	};
export const Car = model('car', carSchema);
