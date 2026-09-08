import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';

const config = {
  apiKey: 'AIzaSyCVY90upeKcuR5u8VPzqNmI-TFe2CDSL14',
  authDomain: 'gp-statistical.firebaseapp.com',
  projectId: 'gp-statistical',
  storageBucket: 'gp-statistical.firebasestorage.app',
  messagingSenderId: '870570090818',
  appId: '1:870570090818:web:0a140685c61b3ec95ea8db',
  measurementId: 'G-XN7Y4JYJLT'
};

if (!getApps().length) initializeApp(config);
