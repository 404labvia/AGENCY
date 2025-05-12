import { Property } from './types';
import { Home, Maximize } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:translate-y-[-5px] transition-transform duration-300">
      <img
        src={property.immagine}
        alt={`Immagine di ${property.tipo} in ${property.indirizzo}`}
        className="w-full h-[200px] object-cover"
      />
      <div className="p-5">
        <h2 className="text-xl font-semibold text-gray-800 mb-1 truncate">
          <a href={property.url} target="_blank" className="hover:text-indigo-600 transition-colors">
            {property.tipo} in {property.indirizzo}
          </a>
        </h2>
        <p className="text-sm text-gray-500 mb-3">{property.zona}, {property.citta}</p>
        <div className="bg-emerald-500 text-white text-lg font-bold py-1 px-3 rounded-md inline-block mb-3">
          {property.prezzo.toLocaleString('it-IT')}€
        </div>
        {property.prezzo_precedente && (
          <p className="text-xs text-red-500 mb-3">
            Prezzo precedente {property.prezzo_precedente.toLocaleString('it-IT')}€
          </p>
        )}
        <div className="flex items-center text-sm text-gray-600 mb-1">
          <Home className="w-4 h-4 mr-2 opacity-70" />
          {property.locali} locali
        </div>
        <div className="flex items-center text-sm text-gray-600 mb-4">
          <Maximize className="w-4 h-4 mr-2 opacity-70" />
          {property.metratura} m²
        </div>
        <p className="text-gray-700 text-sm leading-relaxed h-20 overflow-hidden mb-3">
          {property.descrizione_breve}
        </p>
      </div>
      <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">Agenzia: {property.agenzia}</p>
      </div>
    </div>
  );
}