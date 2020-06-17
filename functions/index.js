var firebaseConfig = {
  apiKey: "AIzaSyD8F4wTTOruQQ54QurxsiPtzPmreUerrEo",
  authDomain: "little-brother-55371.firebaseapp.com",
  databaseURL: "https://little-brother-55371.firebaseio.com",
  projectId: "little-brother-55371",
  storageBucket: "little-brother-55371.appspot.com",
  messagingSenderId: "313102563105",
  appId: "1:313102563105:web:136fc08996652b6b9ef060",
  measurementId: "G-76ESB0C0N3"
};

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(firebaseConfig);
const express = require('express');
const cookieParser = require('cookie-parser')();
const cors = require('cors')({origin: true});
const app = express();

// Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
const validateFirebaseIdToken = async (req, res, next) => {
  console.log('Check if request is authorized with Firebase ID token');

  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) &&
      !(req.cookies && req.cookies.__session)) {
    console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.',
        'Make sure you authorize your request by providing the following HTTP header:',
        'Authorization: Bearer <Firebase ID Token>',
        'or by passing a "__session" cookie.');
    res.status(403).send('Unauthorized');
    return;
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    console.log('Found "Authorization" header');
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1];
  } else if(req.cookies) {
    console.log('Found "__session" cookie');
    // Read the ID Token from cookie.
    idToken = req.cookies.__session;
  } else {
    // No cookie
    res.status(403).send('Unauthorized');
    return;
  }

  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    console.log(decodedIdToken);
    req.user = decodedIdToken;
    next();
    return;
  } catch (error) {
    console.error('Error while verifying Firebase ID token:', error);
    res.status(403).send('Unauthorized');
    return;
  }
};
//middleware
app.use(cors);
app.use(cookieParser);
app.use(validateFirebaseIdToken);

  app.get('/', (req, res) => {
    res.send(null);
});
//list of all camera
app.get('/camera', (req, res) => {
  admin.database().ref("camera").once('value').then(function(dataSnapShot){
    res.send(dataSnapShot)
  });
});
app.post('/camera', (req, res) => {
  admin.database().ref('camera').push(req.body);
  res.send("camera successfuly added");
});
// --- USER --- //
app.get("/user", (req, res) => {
  admin.database().ref("user").once('value').then(function(dataSnapShot){
    res.send(dataSnapShot)
  });
});
app.post("/user", (req, res) => {
  admin.database().ref('user/'+ req.user.user_id).child("fcm").set(req.query.fcm);
  res.send(true);
});

// This HTTPS endpoint can only be accessed by your Firebase Users.
// Requests need to be authorized by providing an `Authorization` HTTP header
// with value `Bearer <Firebase ID Token>`.
exports.app = functions.region('europe-west1').https.onRequest(app);  