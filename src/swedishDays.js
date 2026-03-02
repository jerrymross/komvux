// ============ SWEDISH RED DAYS & NAME DAYS ============

// Easter calculation (Anonymous Gregorian algorithm)
const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const fmtKey = (m, d) => `${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const fmtDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Get Swedish red days for a given year
export const getRedDays = (year) => {
  const easter = getEasterDate(year);
  const days = {};

  const add = (date, name) => {
    days[fmtDateKey(date)] = name;
  };

  // Fixed holidays
  add(new Date(year, 0, 1), 'Nyårsdagen');
  add(new Date(year, 0, 6), 'Trettondedag jul');
  add(new Date(year, 4, 1), 'Första maj');
  add(new Date(year, 5, 6), 'Sveriges nationaldag');
  add(new Date(year, 11, 24), 'Julafton');
  add(new Date(year, 11, 25), 'Juldagen');
  add(new Date(year, 11, 26), 'Annandag jul');
  add(new Date(year, 11, 31), 'Nyårsafton');

  // Easter-based moveable holidays
  add(addDays(easter, -2), 'Långfredagen');
  add(addDays(easter, -1), 'Påskafton');
  add(easter, 'Påskdagen');
  add(addDays(easter, 1), 'Annandag påsk');
  add(addDays(easter, 39), 'Kristi himmelsfärdsdag');
  add(addDays(easter, 49), 'Pingstdagen');

  // Midsommar: Friday & Saturday between June 19-25 / 20-26
  const june19 = new Date(year, 5, 19);
  for (let i = 0; i < 7; i++) {
    const d = addDays(june19, i);
    if (d.getDay() === 5) { // Friday
      add(d, 'Midsommarafton');
      add(addDays(d, 1), 'Midsommardagen');
      break;
    }
  }

  // Alla helgons dag: Saturday between Oct 31 - Nov 6
  const oct31 = new Date(year, 9, 31);
  for (let i = 0; i < 7; i++) {
    const d = addDays(oct31, i);
    if (d.getDay() === 6) { // Saturday
      add(d, 'Alla helgons dag');
      break;
    }
  }

  return days;
};

// Check if a date key is a red day
export const isRedDay = (dateKey, redDaysCache) => {
  return redDaysCache[dateKey] || null;
};

// Swedish name days (official Swedish almanac)
const NAME_DAYS = {
  '01-01': 'Nyårsdagen',
  '01-02': 'Svea, Sverker',
  '01-03': 'Alfred, Alfrida',
  '01-04': 'Rut, Ritva',
  '01-05': 'Hanna, Hannele',
  '01-06': 'Kasper, Melker, Baltsar',
  '01-07': 'August, Augusta',
  '01-08': 'Erland, Erlend',
  '01-09': 'Gunnar, Gunder',
  '01-10': 'Sigurd, Sigbritt',
  '01-11': 'Jan, Jansen',
  '01-12': 'Frideborg, Fridolf',
  '01-13': 'Knut',
  '01-14': 'Felix, Felicia',
  '01-15': 'Laura, Lorentz',
  '01-16': 'Hjalmar, Helmer',
  '01-17': 'Anton, Tony',
  '01-18': 'Hilda, Hildur',
  '01-19': 'Henrik, Henry',
  '01-20': 'Fabian, Sebastian',
  '01-21': 'Agnes, Agneta',
  '01-22': 'Vincent, Viktor',
  '01-23': 'Freja, Frej',
  '01-24': 'Erika, Erik',
  '01-25': 'Paul, Pål',
  '01-26': 'Bodil, Boel',
  '01-27': 'Göte, Göta',
  '01-28': 'Karl, Karla',
  '01-29': 'Diana, Diana',
  '01-30': 'Gunilla, Gunhild',
  '01-31': 'Ivar, Joar',
  '02-01': 'Max, Maximilian',
  '02-02': 'Kyndelsmässodagen',
  '02-03': 'Disa, Hjördis',
  '02-04': 'Ansgar, Ansgarius',
  '02-05': 'Agata, Agda',
  '02-06': 'Dorotea, Dorothea',
  '02-07': 'Rikard, Dick',
  '02-08': 'Berta, Bert',
  '02-09': 'Fanny, Franciska',
  '02-10': 'Iris, Iris',
  '02-11': 'Yngve, Inge',
  '02-12': 'Evelina, Evy',
  '02-13': 'Agne, Ove',
  '02-14': 'Valentin, Tina',
  '02-15': 'Sigfrid, Sigbritt',
  '02-16': 'Julia, Julius',
  '02-17': 'Alexandra, Sandra',
  '02-18': 'Frida, Fritiof',
  '02-19': 'Gabriella, Ella',
  '02-20': 'Vivianne, Vivian',
  '02-21': 'Hilding, Hildur',
  '02-22': 'Pia, Pia',
  '02-23': 'Torsten, Torun',
  '02-24': 'Mattias, Mats',
  '02-25': 'Sigvard, Sivert',
  '02-26': 'Torgny, Torkel',
  '02-27': 'Lage, Laila',
  '02-28': 'Maria, Marie',
  '02-29': 'Skottdagen',
  '03-01': 'Albin, Elvira',
  '03-02': 'Ernst, Erna',
  '03-03': 'Gunborg, Gunvor',
  '03-04': 'Adrian, Adriana',
  '03-05': 'Tora, Tove',
  '03-06': 'Ebba, Ebbe',
  '03-07': 'Camilla, Kamel',
  '03-08': 'Siv, Saga',
  '03-09': 'Torbjörn, Torleif',
  '03-10': 'Edla, Ada',
  '03-11': 'Edvin, Egon',
  '03-12': 'Viktoria, Viktor',
  '03-13': 'Greger, Gregor',
  '03-14': 'Matilda, Maud',
  '03-15': 'Kristoffer, Christel',
  '03-16': 'Herbert, Gilbert',
  '03-17': 'Gertrud, Görel',
  '03-18': 'Edvard, Edmund',
  '03-19': 'Josef, Josefina',
  '03-20': 'Joakim, Kim',
  '03-21': 'Bengt, Bength',
  '03-22': 'Kennet, Kent',
  '03-23': 'Gerda, Gerd',
  '03-24': 'Gabriel, Rafael',
  '03-25': 'Marie bebådelsedag',
  '03-26': 'Emanuel, Manne',
  '03-27': 'Rudolf, Ralf',
  '03-28': 'Malkolm, Morgan',
  '03-29': 'Jonas, Jansen',
  '03-30': 'Holger, Holmfrid',
  '03-31': 'Ester, Estrid',
  '04-01': 'Harald, Hervor',
  '04-02': 'Gudmund, Ingemund',
  '04-03': 'Ferdinand, Nansen',
  '04-04': 'Marianne, Marlene',
  '04-05': 'Irene, Irja',
  '04-06': 'Vilhelm, Helmi',
  '04-07': 'Irma, Irmelin',
  '04-08': 'Nadja, Tanja',
  '04-09': 'Otto, Ottilia',
  '04-10': 'Ingvar, Ingvor',
  '04-11': 'Ulf, Ylva',
  '04-12': 'Liv, Livia',
  '04-13': 'Artur, Douglas',
  '04-14': 'Tiburtius, Tibor',
  '04-15': 'Olivia, Oliver',
  '04-16': 'Patrik, Patricia',
  '04-17': 'Elias, Elis',
  '04-18': 'Valdemar, Volmar',
  '04-19': 'Olaus, Ola',
  '04-20': 'Amalia, Amelie',
  '04-21': 'Anneli, Annika',
  '04-22': 'Allan, Glenn',
  '04-23': 'Georg, Göran',
  '04-24': 'Vega, Viveka',
  '04-25': 'Markus, Mark',
  '04-26': 'Teresia, Terese',
  '04-27': 'Engelbrekt, Enok',
  '04-28': 'Ture, Tyra',
  '04-29': 'Tyko, Kennet',
  '04-30': 'Mariana, Marianne',
  '05-01': 'Valborg, Maj',
  '05-02': 'Filip, Filippa',
  '05-03': 'John, Jane',
  '05-04': 'Monika, Mona',
  '05-05': 'Gotthard, Erhard',
  '05-06': 'Marit, Rita',
  '05-07': 'Carina, Carita',
  '05-08': 'Åke, Ove',
  '05-09': 'Reidar, Reidun',
  '05-10': 'Esbjörn, Styrbjörn',
  '05-11': 'Märta, Märit',
  '05-12': 'Charlotta, Lottie',
  '05-13': 'Linnea, Linn',
  '05-14': 'Halvard, Halvar',
  '05-15': 'Sofia, Sonja',
  '05-16': 'Ronald, Ronny',
  '05-17': 'Rebecka, Ruben',
  '05-18': 'Erik, Eriksson',
  '05-19': 'Maj, Majken',
  '05-20': 'Karolina, Carola',
  '05-21': 'Konstantin, Conny',
  '05-22': 'Hemming, Henning',
  '05-23': 'Desideria, Desiree',
  '05-24': 'Ivan, Vanja',
  '05-25': 'Urban, Urbana',
  '05-26': 'Vilhelmina, Vilma',
  '05-27': 'Beda, Blenda',
  '05-28': 'Ingeborg, Borghild',
  '05-29': 'Yvonne, Jansen',
  '05-30': 'Vera, Veronika',
  '05-31': 'Petronella, Pernilla',
  '06-01': 'Gun, Gunnel',
  '06-02': 'Rutger, Roger',
  '06-03': 'Ingemar, Gudmar',
  '06-04': 'Solbritt, Solveig',
  '06-05': 'Bo, Boris',
  '06-06': 'Gustav, Gösta',
  '06-07': 'Robert, Robin',
  '06-08': 'Eivor, Majvor',
  '06-09': 'Börje, Birger',
  '06-10': 'Svante, Boris',
  '06-11': 'Bertil, Berthold',
  '06-12': 'Eskil, Esbjörn',
  '06-13': 'Aina, Aino',
  '06-14': 'Håkan, Hakon',
  '06-15': 'Margit, Margot',
  '06-16': 'Axel, Axelina',
  '06-17': 'Torborg, Torvald',
  '06-18': 'Björn, Bjarne',
  '06-19': 'Germund, Görel',
  '06-20': 'Linda, Lind',
  '06-21': 'Alf, Alvar',
  '06-22': 'Paulina, Paula',
  '06-23': 'Adolf, Alice',
  '06-24': 'Johannes Döparens dag',
  '06-25': 'David, Salomon',
  '06-26': 'Rakel, Lea',
  '06-27': 'Selma, Fingal',
  '06-28': 'Leo, Leopold',
  '06-29': 'Petrus, Peter',
  '06-30': 'Elof, Leif',
  '07-01': 'Aron, Mirjam',
  '07-02': 'Rosa, Rosita',
  '07-03': 'Aurora, Adina',
  '07-04': 'Ulrika, Ulla',
  '07-05': 'Laila, Ritva',
  '07-06': 'Esaias, Jessika',
  '07-07': 'Klas, Kaj',
  '07-08': 'Kjell, Tjelvar',
  '07-09': 'Jörgen, Örjan',
  '07-10': 'André, Andrea',
  '07-11': 'Eleonora, Ellinor',
  '07-12': 'Herman, Hermine',
  '07-13': 'Joel, Judit',
  '07-14': 'Folke, Folkvar',
  '07-15': 'Ragnhild, Ragnvald',
  '07-16': 'Reinhold, Reine',
  '07-17': 'Bruno, Brynolf',
  '07-18': 'Fredrik, Fritz',
  '07-19': 'Sara, Sally',
  '07-20': 'Margareta, Greta',
  '07-21': 'Johanna, Jana',
  '07-22': 'Magdalena, Madeleine',
  '07-23': 'Emma, Emmy',
  '07-24': 'Kristina, Kerstin',
  '07-25': 'Jakob, James',
  '07-26': 'Jesper, Jasmin',
  '07-27': 'Marta, Moa',
  '07-28': 'Botvid, Selja',
  '07-29': 'Olof, Olov',
  '07-30': 'Algot, Margot',
  '07-31': 'Helena, Elin',
  '08-01': 'Per, Pernilla',
  '08-02': 'Karin, Kajsa',
  '08-03': 'Tage, Tanja',
  '08-04': 'Arne, Arnold',
  '08-05': 'Ulrik, Alrik',
  '08-06': 'Alfons, Inez',
  '08-07': 'Dennis, Denise',
  '08-08': 'Silvia, Sylvia',
  '08-09': 'Roland, Roine',
  '08-10': 'Lars, Lorentz',
  '08-11': 'Susanna, Sanna',
  '08-12': 'Klara, Clary',
  '08-13': 'Kaj, Kajen',
  '08-14': 'Uno, Unn',
  '08-15': 'Stella, Estelle',
  '08-16': 'Brynolf, Bror',
  '08-17': 'Verner, Valter',
  '08-18': 'Ellen, Lena',
  '08-19': 'Magnus, Måns',
  '08-20': 'Bernhard, Bernt',
  '08-21': 'Jon, Jansen',
  '08-22': 'Henrietta, Henrika',
  '08-23': 'Signe, Signhild',
  '08-24': 'Bartolomeus, Bert',
  '08-25': 'Lovisa, Louise',
  '08-26': 'Östen, Ejsten',
  '08-27': 'Rolf, Raoul',
  '08-28': 'Fatima, Leila',
  '08-29': 'Hans, Hampus',
  '08-30': 'Albert, Albertina',
  '08-31': 'Arvid, Vidar',
  '09-01': 'Samuel, Sam',
  '09-02': 'Justus, Justina',
  '09-03': 'Alfhild, Alva',
  '09-04': 'Gisela, Gisella',
  '09-05': 'Adela, Heidi',
  '09-06': 'Lena, Lina',
  '09-07': 'Regina, Roy',
  '09-08': 'Alma, Hulda',
  '09-09': 'Anita, Annette',
  '09-10': 'Tord, Turid',
  '09-11': 'Dagny, Helny',
  '09-12': 'Åsa, Åslög',
  '09-13': 'Sture, Styrbjörn',
  '09-14': 'Ida, Ronja',
  '09-15': 'Sigrid, Siri',
  '09-16': 'Dag, Daga',
  '09-17': 'Hildegard, Magnhild',
  '09-18': 'Orvar, Alvar',
  '09-19': 'Fredrika, Fred',
  '09-20': 'Elise, Lisa',
  '09-21': 'Matteus, Mateus',
  '09-22': 'Maurits, Moritz',
  '09-23': 'Tekla, Tea',
  '09-24': 'Gerhard, Gert',
  '09-25': 'Tryggve, Trygve',
  '09-26': 'Einar, Enar',
  '09-27': 'Dagmar, Rigmor',
  '09-28': 'Lennart, Leonard',
  '09-29': 'Mikael, Mikaela',
  '09-30': 'Helge, Helny',
  '10-01': 'Ragnar, Ragna',
  '10-02': 'Ludvig, Louis',
  '10-03': 'Evald, Osvald',
  '10-04': 'Frans, Frank',
  '10-05': 'Bror, Bruno',
  '10-06': 'Jenny, Jennifer',
  '10-07': 'Birgitta, Britta',
  '10-08': 'Nils, Nille',
  '10-09': 'Ingrid, Inger',
  '10-10': 'Harry, Harriet',
  '10-11': 'Erling, Jarl',
  '10-12': 'Valfrid, Manfred',
  '10-13': 'Berit, Birgit',
  '10-14': 'Stellan, Stella',
  '10-15': 'Hedvig, Hillevi',
  '10-16': 'Finn, Finlay',
  '10-17': 'Antonia, Toini',
  '10-18': 'Lukas, Luka',
  '10-19': 'Tore, Tor',
  '10-20': 'Sibylla, Sibyl',
  '10-21': 'Ursula, Yrsa',
  '10-22': 'Marika, Marita',
  '10-23': 'Severin, Sören',
  '10-24': 'Evert, Eilert',
  '10-25': 'Inga, Ingalill',
  '10-26': 'Amanda, Rasmus',
  '10-27': 'Sabina, Sabine',
  '10-28': 'Simon, Simone',
  '10-29': 'Viola, Vivi',
  '10-30': 'Elsa, Isabella',
  '10-31': 'Edit, Edgar',
  '11-01': 'Allhelgonadagen',
  '11-02': 'Tobias, Tobbe',
  '11-03': 'Hubert, Hugo',
  '11-04': 'Sverker, Sune',
  '11-05': 'Eugen, Eugene',
  '11-06': 'Gustav Adolf',
  '11-07': 'Ingegerd, Ingela',
  '11-08': 'Vendela, Vanda',
  '11-09': 'Teodor, Teodora',
  '11-10': 'Martin, Martina',
  '11-11': 'Mårten, Morten',
  '11-12': 'Konrad, Kurt',
  '11-13': 'Kristian, Krister',
  '11-14': 'Emil, Emilia',
  '11-15': 'Leopold, Leopoldin',
  '11-16': 'Vibeke, Viveka',
  '11-17': 'Naemi, Naima',
  '11-18': 'Lillemor, Mormor',
  '11-19': 'Elisabet, Lisbet',
  '11-20': 'Pontus, Marina',
  '11-21': 'Helga, Olga',
  '11-22': 'Cecilia, Sissela',
  '11-23': 'Klemens, Clarence',
  '11-24': 'Gudrun, Rune',
  '11-25': 'Katarina, Katja',
  '11-26': 'Linus, Love',
  '11-27': 'Astrid, Asta',
  '11-28': 'Malte, Malkolm',
  '11-29': 'Sölve, Solveig',
  '11-30': 'Andreas, Anders',
  '12-01': 'Oskar, Ossian',
  '12-02': 'Beata, Beatrice',
  '12-03': 'Lydia, Cornelia',
  '12-04': 'Barbara, Barbro',
  '12-05': 'Sven, Svenja',
  '12-06': 'Nikolaus, Niklas',
  '12-07': 'Angela, Angelika',
  '12-08': 'Virginia, Vera',
  '12-09': 'Anna, Annie',
  '12-10': 'Malin, Malena',
  '12-11': 'Daniel, Daniella',
  '12-12': 'Alexander, Alexis',
  '12-13': 'Lucia, Lucinda',
  '12-14': 'Sten, Sixten',
  '12-15': 'Gottfrid, Gottfridina',
  '12-16': 'Assar, Astor',
  '12-17': 'Stig, Staffan',
  '12-18': 'Abraham, Efraim',
  '12-19': 'Isak, Rebecka',
  '12-20': 'Israel, Moses',
  '12-21': 'Tomas, Tom',
  '12-22': 'Natanael, Jonatan',
  '12-23': 'Adam, Eva',
  '12-24': 'Julafton',
  '12-25': 'Juldagen',
  '12-26': 'Stefan, Staffan',
  '12-27': 'Johannes, Johan',
  '12-28': 'Värnlösa barns dag',
  '12-29': 'Abel, Set',
  '12-30': 'Sylvester, David',
  '12-31': 'Nyårsafton'
};

// Get name day for a date
export const getNameDay = (date) => {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return NAME_DAYS[`${m}-${d}`] || '';
};

// Get name day by dateKey (YYYY-MM-DD)
export const getNameDayByKey = (dateKey) => {
  const parts = dateKey.split('-');
  return NAME_DAYS[`${parts[1]}-${parts[2]}`] || '';
};
