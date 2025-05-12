import { Property } from './types';
import PropertyCard from './PropertyCard';

interface PropertyGridProps {
  properties: Property[];
}

export default function PropertyGrid({ properties }: PropertyGridProps) {
  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-100">
      {properties.length > 0 ? (
        <div className="grid grid-cols-2 gap-6">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>Chiedi all'assistente informazioni sugli immobili disponibili</p>
        </div>
      )}
    </div>
  );
}