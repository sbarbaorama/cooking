// Ricette di esempio, utili per provare l'app
export const SAMPLE_RECIPES = [
  {
    title: 'Spaghetti alla carbonara',
    description: 'Il classico romano: guanciale croccante, tuorli e pecorino, senza panna.',
    servings: 4, prepTime: 15, cookTime: 15, difficulty: 'facile', category: 'Primi', cuisine: 'Romana', tags: ['classici', 'veloce'],
    ingredients: ['320 g di spaghetti', '150 g di guanciale', '4 tuorli', 'Pecorino romano 50 g', 'Pepe nero q.b.', 'Sale q.b.'],
    steps: [
      'Taglia il guanciale a listarelle e rosolalo in padella senza olio per 8 minuti, finché diventa croccante.',
      'Cuoci gli spaghetti in abbondante acqua salata per il tempo indicato sulla confezione (circa 10 minuti).',
      'In una ciotola sbatti i tuorli con il pecorino e una generosa macinata di pepe.',
      'Scola la pasta al dente tenendo un mestolo di acqua di cottura e versala nella padella del guanciale a fuoco spento.',
      'Aggiungi la crema di uova e mescola velocemente, allungando con un po’ di acqua di cottura fino a ottenere una crema.',
      'Servi subito con altro pecorino e pepe.',
    ],
    notes: 'Il segreto è mescolare a fuoco spento: le uova non devono rapprendersi.',
  },
  {
    title: 'Frittata di zucchine',
    description: 'Un secondo veloce e leggero, ottimo anche freddo il giorno dopo.',
    servings: 2, prepTime: 10, cookTime: 15, difficulty: 'facile', category: 'Secondi', cuisine: 'Italiana', tags: ['vegetariana', 'veloce', 'svuotafrigo'],
    ingredients: ['4 uova', '2 zucchine', '1 cipolla', '30 g di parmigiano grattugiato', '2 cucchiai di olio extravergine di oliva', 'Sale q.b.', 'Pepe q.b.', 'Basilico (facoltativo)'],
    steps: [
      'Affetta sottilmente la cipolla e taglia le zucchine a rondelle.',
      'Fai appassire la cipolla nell’olio per 3 minuti, poi aggiungi le zucchine e cuoci per 8 minuti.',
      'Sbatti le uova con il parmigiano, sale e pepe, e versale sulle verdure.',
      'Cuoci a fuoco basso con il coperchio per 5 minuti, gira la frittata aiutandoti con un piatto e cuoci altri 3 minuti.',
    ],
  },
  {
    title: 'Pasta al pomodoro e basilico',
    description: 'Semplice, profumata, sempre buona.',
    servings: 4, prepTime: 5, cookTime: 25, difficulty: 'molto facile', category: 'Primi', cuisine: 'Italiana', tags: ['vegetariana', 'classici'],
    ingredients: ['320 g di pasta', '700 g di passata di pomodoro', '1 spicchio di aglio', '3 cucchiai di olio extravergine di oliva', 'Basilico fresco q.b.', 'Parmigiano q.b.', 'Sale q.b.'],
    steps: [
      'Scalda l’olio con lo spicchio d’aglio schiacciato per 2 minuti.',
      'Aggiungi la passata, sala e cuoci a fuoco medio per 20 minuti.',
      'Togli l’aglio e aggiungi qualche foglia di basilico.',
      'Cuoci la pasta, scolala al dente e saltala nel sugo. Servi con parmigiano e basilico.',
    ],
  },
  {
    title: 'Tiramisù',
    description: 'Il dolce al cucchiaio più amato, nella versione classica.',
    servings: 6, prepTime: 30, totalTime: 270, difficulty: 'media', category: 'Dolci', cuisine: 'Veneta', tags: ['dolci', 'senza cottura'],
    ingredients: ['Per la crema:', '4 uova', '100 g di zucchero', '500 g di mascarpone', 'Per completare:', '300 g di savoiardi', '300 ml di caffè', 'Cacao amaro q.b.'],
    steps: [
      'Prepara il caffè e lascialo raffreddare.',
      'Monta i tuorli con lo zucchero per 5 minuti, finché diventano chiari e spumosi, poi incorpora il mascarpone.',
      'Monta gli albumi a neve ferma e uniscili delicatamente alla crema.',
      'Inzuppa velocemente i savoiardi nel caffè e disponili in una pirofila; alterna strati di savoiardi e crema.',
      'Spolvera con il cacao e lascia in frigorifero per almeno 4 ore prima di servire.',
    ],
  },
  {
    title: 'Pollo al limone',
    description: 'Bocconcini teneri con una salsina agrumata, pronti in mezz’ora.',
    servings: 4, prepTime: 10, cookTime: 15, difficulty: 'facile', category: 'Secondi', cuisine: 'Italiana', tags: ['veloce', 'carne'],
    ingredients: ['600 g di petto di pollo', '2 limoni', '2 cucchiai di farina', '30 g di burro', '1 cucchiaio di olio extravergine di oliva', 'Prezzemolo q.b.', 'Sale q.b.', 'Pepe q.b.'],
    steps: [
      'Taglia il pollo a bocconcini e infarinali leggermente.',
      'Scalda burro e olio in padella e rosola il pollo a fuoco vivace per 6 minuti.',
      'Aggiungi il succo dei limoni e la scorza grattugiata, sala e pepa e cuoci altri 5 minuti finché la salsa si addensa.',
      'Completa con prezzemolo tritato e servi.',
    ],
  },
];
