import { Property } from './types';

interface PropertyWebViewProps {
  property?: Property | null;
}

export default function PropertyWebView({ property }: PropertyWebViewProps) {
  return (
    <div className="h-full w-full flex flex-col bg-gray-100">
      {property ? (
        <div className="h-full w-full flex flex-col">
          <div className="bg-white p-4 shadow-md">
            <h2 className="text-xl font-semibold text-gray-800">
              {property.tipo} - {property.zona}
            </h2>
            <p className="text-emerald-600 font-bold">
              {property.prezzo.toLocaleString('it-IT')}€
            </p>
          </div>
          <div className="flex-1 w-full">
            <iframe
              src={property.url}
              className="w-full h-full border-0"
              title={`${property.tipo} in ${property.zona}`}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              loading="lazy"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>Chiedi all'assistente informazioni sugli immobili disponibili</p>
        </div>
      )}
    </div>
  );
}