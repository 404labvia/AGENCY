import { Property } from './types';

export const formatPrice = (price: number): string => {
try {
return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  } catch (error) {
    console.error('Errore nella formattazione del prezzo:', error);
    return `${price.toLocaleString('it-IT')}€`;
  }
};

export const filterProperties = (
  properties: Property[],
  filters: {
    minPrice?: number;
    maxPrice?: number;
    zona?: string;
    tipo?: string;
    minLocali?: number;
  }
): Property[] => {
  if (!properties?.length) return [];

  return properties.filter(property => {
    try {
      if (filters.minPrice && property.prezzo < filters.minPrice) return false;
      if (filters.maxPrice && property.prezzo > filters.maxPrice) return false;
      if (filters.zona && property.zona !== filters.zona) return false;
      if (filters.tipo && property.tipo !== filters.tipo) return false;
      if (filters.minLocali && property.locali < filters.minLocali) return false;
      return true;
    } catch (error) {
      console.error('Errore nel filtraggio della proprietà:', error);
      return false;
    }
  });
};

export const sortProperties = (
  properties: Property[],
  sortBy: 'prezzo' | 'metratura' | 'locali',
  order: 'asc' | 'desc' = 'asc'
): Property[] => {
  if (!properties?.length) return [];

  try {
    return [...properties].sort((a, b) => {
      const comparison = a[sortBy] - b[sortBy];
      return order === 'asc' ? comparison : -comparison;
    });
  } catch (error) {
    console.error('Errore nell\'ordinamento delle proprietà:', error);
    return properties;
  }
};