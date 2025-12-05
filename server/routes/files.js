const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const { authenticateJWT } = require('../middleware/auth');
const router = express.Router();

const upload = multer({ dest: 'uploads/', limits: { fileSize: 100 * 1024 * 1024 } });
const s3 = new AWS.S3({ 
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1'
});

router.post('/transfer', authenticateJWT, upload.single('file'), async (req, res) => {
  try {
    const fileKey = `connec-tra/${Date.now()}-${req.file.originalname}`;
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: fileKey,
      Body: require('fs').createReadStream(req.file.path),
      ContentType: req.file.mimetype
    };
    
    const result = await s3.upload(params).promise();
    require('fs').unlinkSync(req.file.path);
    
    res.json({ url: result.Location, size: req.file.size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/download/:key', authenticateJWT, async (req, res) => {
  const params = { Bucket: process.env.S3_BUCKET, Key: req.params.key };
  s3.getObject(params).createReadStream().pipe(res);
});

module.exports = router;
