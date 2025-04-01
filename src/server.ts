import express, { Request, Response } from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { stringify } from 'csv-stringify';

declare module 'express-session' {
    interface SessionData {
      lastVerseTime: string;
    }
  }

dotenv.config();

// Utilitaires pour lire/écrire des fichiers JSON
const readJSON = (filePath: string): any[] => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.trim() ? JSON.parse(content) : [];
  }
  return [];
};

const writeJSON = (filePath: string, data: any[]): void => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const app = express();

// Configuration des sessions
app.use(session({
  secret: process.env.SESSION_SECRET || 'default_secret', // à remplacer par une clé sécurisée
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24h
}));

// Configuration du moteur de template EJS et des fichiers statiques
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Middleware pour parser le corps des requêtes
app.use(bodyParser.urlencoded({ extended: true }));

// Chemin des fichiers JSON
const bibleFile = path.join(__dirname, '..', 'bible.json');
const requestsFile = path.join(__dirname, '..', 'requests.json');

// Route : Page d'accueil (formulaire d'entrée)
app.get('/', (req: Request, res: Response) => {
  res.render('index');
});

// Route : Traitement du formulaire et affichage d'un verset
app.post('/verse', (req: Request, res: Response) => {
  // Vérifier si l'utilisateur a déjà reçu un verset dans les 24h
  if (req.session.lastVerseTime) {
    const lastTime = new Date(req.session.lastVerseTime);
    if (Date.now() - lastTime.getTime() < 24 * 60 * 60 * 1000) {
      return res.render('limit_reached', { message: "Vous avez déjà reçu un verset dans les dernières 24 heures. Veuillez réessayer plus tard." });
    }
  }

  const userName = req.body.name?.trim() || "Invité";
  const phoneNumber = req.body.number;

  // Lecture du fichier bible.json
  const verses = readJSON(bibleFile);
  const verse = verses[Math.floor(Math.random() * verses.length)];

  // Enregistrement de l'heure d'envoi du verset
  req.session.lastVerseTime = new Date().toISOString();

  // Transmettez les informations à la vue
  res.render('verse', { userName, phoneNumber, verse });
});

// Route : Traitement du formulaire du sujet de prière
app.post('/prayer', (req: Request, res: Response) => {
  const { name, number, prayer } = req.body;
  
  // Lecture existante et ajout de la nouvelle demande
  const requests = readJSON(requestsFile);
  requests.push({
    name,
    phone: number,
    prayer,
    submitted_at: new Date().toISOString()
  });
  writeJSON(requestsFile, requests);

  res.render('thank_you');
});

// Route : Export CSV des demandes de prière
app.get('/export.csv', (req: Request, res: Response) => {
  const requests = readJSON(requestsFile);
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="prayer_requests.csv"');

  // Définir les en-têtes du CSV
  const header = ["Nom", "Téléphone", "Sujet de prière", "Date de soumission"];
  const records = requests.map(reqData => [
    reqData.name,
    reqData.phone,
    reqData.prayer,
    reqData.submitted_at
  ]);

  // Génération du CSV et envoi
  stringify([header, ...records], (err, output) => {
    if (err) {
      return res.status(500).send("Erreur lors de la génération du CSV");
    }
    res.send(output);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
