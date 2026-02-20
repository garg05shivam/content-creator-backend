import mongoose from "mongoose";

const assetSchema = new mongoose.Schema({
    title:{
        type: String,
        required: true
    },
    description:{
        type: String,
        required: true
    },
    type:{
        type: String,
        enum:['video','image'],
        required: true
    },
    url:{
        type: String,
        required: true
    },
    tags:{
        type: [String],
        default: []
    },
    visibility:{
        type: String,
        enum:['public','private'],
        default: 'public'
    },
    owner:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt:{
        type: Date,
        default: Date.now
    },
});


export default mongoose.model('Asset', assetSchema);