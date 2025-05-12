export interface Property {
id: string;
tipo: string;
indirizzo: string;
zona: string;
citta: string;
prezzo: number;
prezzo_precedente?: number;
locali: number;
metratura: number;
descrizione_breve: string;
descrizione_completa: string;
caratteristiche: string[];
stato: string;
agenzia: string;
immagine: string;
url: string;
parole_chiave: string[];
distanza_mare?: number;
}

export interface PropertySuggestion {
type: "property_suggestion";
properties: Property[];
}

export interface AvatarPropertyMessage {
content: string;
suggestions?: PropertySuggestion;
}