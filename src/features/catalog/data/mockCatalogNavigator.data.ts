import type {
  MockCatalog,
  MockColumn,
  MockFolder,
  MockProduct,
  MockProductValue,
} from "@/features/catalog/types/catalog-navigator.types";

type ColumnDefinition = {
  internalKey: string;
  displayName: string;
  dataType: MockColumn["dataType"];
  isPrimaryCode?: boolean;
  isDescription?: boolean;
  isImageCode?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
};

type ProductSeed = {
  primaryCode: string;
  description: string;
  values: Record<string, MockProductValue>;
};

const SEVEN_COLUMN_DEFINITIONS: ColumnDefinition[] = [
  {
    internalKey: "codigo",
    displayName: "Código",
    dataType: "text",
    isPrimaryCode: true,
    isSearchable: true,
  },
  {
    internalKey: "descripcion",
    displayName: "Descripción",
    dataType: "text",
    isDescription: true,
    isSearchable: true,
  },
  {
    internalKey: "marca",
    displayName: "Marca",
    dataType: "text",
    isFilterable: true,
  },
  {
    internalKey: "medida",
    displayName: "Medida",
    dataType: "text",
    isFilterable: true,
  },
  {
    internalKey: "aplicacion",
    displayName: "Aplicación",
    dataType: "text",
    isSearchable: true,
  },
  {
    internalKey: "equivalencias",
    displayName: "Equivalencias",
    dataType: "text",
    isSearchable: true,
  },
  {
    internalKey: "observaciones",
    displayName: "Observaciones",
    dataType: "text",
  },
];

const TEN_COLUMN_DEFINITIONS: ColumnDefinition[] = [
  {
    internalKey: "codigo",
    displayName: "Código",
    dataType: "text",
    isPrimaryCode: true,
    isSearchable: true,
  },
  {
    internalKey: "descripcion",
    displayName: "Descripción",
    dataType: "text",
    isDescription: true,
    isSearchable: true,
  },
  {
    internalKey: "marca",
    displayName: "Marca",
    dataType: "text",
    isFilterable: true,
  },
  {
    internalKey: "aplicacion",
    displayName: "Aplicación",
    dataType: "text",
    isSearchable: true,
  },
  {
    internalKey: "modelo",
    displayName: "Modelo",
    dataType: "text",
    isFilterable: true,
  },
  {
    internalKey: "medida",
    displayName: "Medida",
    dataType: "text",
    isFilterable: true,
  },
  {
    internalKey: "cantidad_estrias",
    displayName: "Cantidad estrías",
    dataType: "number",
    isFilterable: true,
  },
  {
    internalKey: "montadora",
    displayName: "Montadora",
    dataType: "text",
    isFilterable: true,
  },
  {
    internalKey: "codigo_imagen",
    displayName: "Código imagen",
    dataType: "text",
    isImageCode: true,
  },
  {
    internalKey: "equivalencias",
    displayName: "Equivalencias",
    dataType: "text",
    isSearchable: true,
  },
];

function buildColumns(folderId: string, definitions: ColumnDefinition[]): MockColumn[] {
  return definitions.map((definition, index) => ({
    id: `${folderId}-col-${definition.internalKey}`,
    internalKey: definition.internalKey,
    displayName: definition.displayName,
    originalName: definition.displayName,
    order: index,
    dataType: definition.dataType,
    visibleToNormalUser: true,
    isPrimaryCode: definition.isPrimaryCode,
    isDescription: definition.isDescription,
    isImageCode: definition.isImageCode,
    isFilterable: definition.isFilterable,
    isSearchable: definition.isSearchable,
  }));
}

function buildProducts(
  folderId: string,
  columns: MockColumn[],
  seeds: ProductSeed[],
): MockProduct[] {
  const columnKeys = columns.map((column) => column.internalKey);

  return seeds.map((seed, index) => {
    const dynamicData = columnKeys.reduce<Record<string, MockProductValue>>(
      (accumulator, key) => {
        accumulator[key] = seed.values[key] ?? null;
        return accumulator;
      },
      {},
    );

    return {
      id: `${folderId}-product-${index + 1}`,
      folderId,
      primaryCode: seed.primaryCode,
      description: seed.description,
      dynamicData,
    };
  });
}

function buildFolder(
  catalogId: string,
  id: string,
  name: string,
  order: number,
  columnDefinitions: ColumnDefinition[],
  productSeeds: ProductSeed[],
): MockFolder {
  const columns = buildColumns(id, columnDefinitions);

  return {
    id,
    catalogId,
    name,
    order,
    visibleToNormalUser: true,
    columns,
    products: buildProducts(id, columns, productSeeds),
  };
}

const rodamientosProducts: ProductSeed[] = [
  {
    primaryCode: "ROL-6205-2RS",
    description: "Rodamiento rígido de bolas sellado",
    values: {
      codigo: "ROL-6205-2RS",
      descripcion: "Rodamiento rígido de bolas sellado",
      marca: "SKF",
      medida: "25x52x15 mm",
      aplicacion: "Mercedes-Benz Axor",
      equivalencias: "6205-2RS1, 6205LLU",
      observaciones: "Alta rotación",
    },
  },
  {
    primaryCode: "ROL-6308-ZZ",
    description: "Rodamiento de transmisión blindado",
    values: {
      codigo: "ROL-6308-ZZ",
      descripcion: "Rodamiento de transmisión blindado",
      marca: "SKF",
      medida: "40x90x23 mm",
      aplicacion: "Scania Serie 4",
      equivalencias: "6308-2Z, 6308ZZ",
      observaciones: "Carga radial media",
    },
  },
  {
    primaryCode: "ROL-30205-J2",
    description: "Rodamiento cónicos métricos",
    values: {
      codigo: "ROL-30205-J2",
      descripcion: "Rodamiento cónicos métricos",
      marca: "SKF",
      medida: "25x52x16.25 mm",
      aplicacion: "Iveco Stralis",
      equivalencias: "30205A, HR30205J",
      observaciones: "Eje delantero",
    },
  },
  {
    primaryCode: "ROL-32008-X",
    description: "Rodamiento cónicos para diferencial",
    values: {
      codigo: "ROL-32008-X",
      descripcion: "Rodamiento cónicos para diferencial",
      marca: "Eaton",
      medida: "40x68x19 mm",
      aplicacion: "Mercedes-Benz Axor",
      equivalencias: "32008X, 4T-32008X",
      observaciones: "Requiere ajuste",
    },
  },
  {
    primaryCode: "ROL-6004-2RS",
    description: "Rodamiento auxiliar de alternador",
    values: {
      codigo: "ROL-6004-2RS",
      descripcion: "Rodamiento auxiliar de alternador",
      marca: "SKF",
      medida: "20x42x12 mm",
      aplicacion: "John Deere",
      equivalencias: "6004LLU, 6004-2RSR",
      observaciones: "Sellado doble",
    },
  },
  {
    primaryCode: "ROL-22210-E",
    description: "Rodamiento autocompensador de rodillos",
    values: {
      codigo: "ROL-22210-E",
      descripcion: "Rodamiento autocompensador de rodillos",
      marca: "SKF",
      medida: "50x90x23 mm",
      aplicacion: "Scania Serie 4",
      equivalencias: "22210E, 22210 CA/W33",
      observaciones: "Carga axial combinada",
    },
  },
  {
    primaryCode: "ROL-30310-J2",
    description: "Rodamiento cónicos para caja",
    values: {
      codigo: "ROL-30310-J2",
      descripcion: "Rodamiento cónicos para caja",
      marca: "Eaton",
      medida: "50x110x29.25 mm",
      aplicacion: "Iveco Stralis",
      equivalencias: "30310A, HR30310J",
      observaciones: "Caja Fuller",
    },
  },
  {
    primaryCode: "ROL-6203-2RS",
    description: "Rodamiento de soporte de ventilador",
    values: {
      codigo: "ROL-6203-2RS",
      descripcion: "Rodamiento de soporte de ventilador",
      marca: "SKF",
      medida: "17x40x12 mm",
      aplicacion: "Mercedes-Benz Axor",
      equivalencias: "6203-2RS1, 6203LLU",
      observaciones: "Uso continuo",
    },
  },
  {
    primaryCode: "ROL-33108",
    description: "Rodamiento cónicos para eje cardán",
    values: {
      codigo: "ROL-33108",
      descripcion: "Rodamiento cónicos para eje cardán",
      marca: "SKF",
      medida: "40x75x27 mm",
      aplicacion: "John Deere",
      equivalencias: "33108A, 4T-33108",
      observaciones: "Cardán central",
    },
  },
  {
    primaryCode: "ROL-6306-2RS",
    description: "Rodamiento de polea tensora",
    values: {
      codigo: "ROL-6306-2RS",
      descripcion: "Rodamiento de polea tensora",
      marca: "SKF",
      medida: "30x72x19 mm",
      aplicacion: "Scania Serie 4",
      equivalencias: "6306-2RS1, 6306LLU",
      observaciones: "Tensor accesorio",
    },
  },
];

const tensoresPesadosProducts: ProductSeed[] = [
  {
    primaryCode: "TENSOR-8140-SKF",
    description: "Tensor de correa accesorios pesado",
    values: {
      codigo: "TENSOR-8140-SKF",
      descripcion: "Tensor de correa accesorios pesado",
      marca: "SKF",
      aplicacion: "Mercedes-Benz Axor",
      modelo: "8140",
      medida: "70 mm",
      cantidad_estrias: 6,
      montadora: "Mercedes-Benz",
      codigo_imagen: "IMG-T8140-01",
      equivalencias: "VKM 6140, GT36540",
    },
  },
  {
    primaryCode: "TENSOR-430-Valeo",
    description: "Tensor de correa poly-V",
    values: {
      codigo: "TENSOR-430-Valeo",
      descripcion: "Tensor de correa poly-V",
      marca: "Valeo",
      aplicacion: "Scania Serie 4",
      modelo: "P410",
      medida: "65 mm",
      cantidad_estrias: 8,
      montadora: "Scania",
      codigo_imagen: "IMG-T430-02",
      equivalencias: "VKM 6400, 534055010",
    },
  },
  {
    primaryCode: "TENSOR-55120-Eaton",
    description: "Tensor hidráulico de correa",
    values: {
      codigo: "TENSOR-55120-Eaton",
      descripcion: "Tensor hidráulico de correa",
      marca: "Eaton",
      aplicacion: "Iveco Stralis",
      modelo: "Cursor 10",
      medida: "82 mm",
      cantidad_estrias: 6,
      montadora: "Iveco",
      codigo_imagen: "IMG-T55120-03",
      equivalencias: "534055030, VKM 6500",
    },
  },
  {
    primaryCode: "TENSOR-6205-Sachs",
    description: "Tensor de correa auxiliar",
    values: {
      codigo: "TENSOR-6205-Sachs",
      descripcion: "Tensor de correa auxiliar",
      marca: "Sachs",
      aplicacion: "John Deere",
      modelo: "6190R",
      medida: "58 mm",
      cantidad_estrias: 5,
      montadora: "John Deere",
      codigo_imagen: "IMG-T6205-04",
      equivalencias: "534055040, VKM 6205",
    },
  },
  {
    primaryCode: "TENSOR-7200-SKF",
    description: "Tensor de correa de ventilador",
    values: {
      codigo: "TENSOR-7200-SKF",
      descripcion: "Tensor de correa de ventilador",
      marca: "SKF",
      aplicacion: "Mercedes-Benz Axor",
      modelo: "1840",
      medida: "75 mm",
      cantidad_estrias: 8,
      montadora: "Mercedes-Benz",
      codigo_imagen: "IMG-T7200-05",
      equivalencias: "VKM 7200, GT36550",
    },
  },
  {
    primaryCode: "TENSOR-9100-Valeo",
    description: "Tensor de correa de alternador",
    values: {
      codigo: "TENSOR-9100-Valeo",
      descripcion: "Tensor de correa de alternador",
      marca: "Valeo",
      aplicacion: "Scania Serie 4",
      modelo: "G440",
      medida: "62 mm",
      cantidad_estrias: 6,
      montadora: "Scania",
      codigo_imagen: "IMG-T9100-06",
      equivalencias: "534055060, VKM 9100",
    },
  },
  {
    primaryCode: "TENSOR-3320-Eaton",
    description: "Tensor de correa de bomba",
    values: {
      codigo: "TENSOR-3320-Eaton",
      descripcion: "Tensor de correa de bomba",
      marca: "Eaton",
      aplicacion: "Iveco Stralis",
      modelo: "Cursor 13",
      medida: "68 mm",
      cantidad_estrias: 7,
      montadora: "Iveco",
      codigo_imagen: "IMG-T3320-07",
      equivalencias: "534055070, VKM 3320",
    },
  },
  {
    primaryCode: "TENSOR-1180-Sachs",
    description: "Tensor de correa de compresor",
    values: {
      codigo: "TENSOR-1180-Sachs",
      descripcion: "Tensor de correa de compresor",
      marca: "Sachs",
      aplicacion: "John Deere",
      modelo: "7230R",
      medida: "60 mm",
      cantidad_estrias: 5,
      montadora: "John Deere",
      codigo_imagen: "IMG-T1180-08",
      equivalencias: "534055080, VKM 1180",
    },
  },
  {
    primaryCode: "TENSOR-6400-SKF",
    description: "Tensor de correa principal",
    values: {
      codigo: "TENSOR-6400-SKF",
      descripcion: "Tensor de correa principal",
      marca: "SKF",
      aplicacion: "Mercedes-Benz Axor",
      modelo: "2540",
      medida: "72 mm",
      cantidad_estrias: 8,
      montadora: "Mercedes-Benz",
      codigo_imagen: "IMG-T6400-09",
      equivalencias: "VKM 6400, GT36560",
    },
  },
  {
    primaryCode: "TENSOR-8800-Valeo",
    description: "Tensor de correa de servicios",
    values: {
      codigo: "TENSOR-8800-Valeo",
      descripcion: "Tensor de correa de servicios",
      marca: "Valeo",
      aplicacion: "Scania Serie 4",
      modelo: "R500",
      medida: "66 mm",
      cantidad_estrias: 6,
      montadora: "Scania",
      codigo_imagen: "IMG-T8800-10",
      equivalencias: "534055100, VKM 8800",
    },
  },
];

const discosProducts: ProductSeed[] = [
  {
    primaryCode: "DISCO-430-10E",
    description: "Disco de embrague 430 mm",
    values: {
      codigo: "DISCO-430-10E",
      descripcion: "Disco de embrague 430 mm",
      marca: "Sachs",
      medida: "430 mm",
      aplicacion: "Mercedes-Benz Axor",
      equivalencias: "1878 000 591, 3400700062",
      observaciones: "10 estrías Eaton",
    },
  },
  {
    primaryCode: "DISCO-380-9E",
    description: "Disco de embrague 380 mm",
    values: {
      codigo: "DISCO-380-9E",
      descripcion: "Disco de embrague 380 mm",
      marca: "Valeo",
      medida: "380 mm",
      aplicacion: "Scania Serie 4",
      equivalencias: "1878 000 602, 3400700105",
      observaciones: "9 estrías",
    },
  },
  {
    primaryCode: "DISCO-395-10E",
    description: "Disco reforzado 395 mm",
    values: {
      codigo: "DISCO-395-10E",
      descripcion: "Disco reforzado 395 mm",
      marca: "Sachs",
      medida: "395 mm",
      aplicacion: "Iveco Stralis",
      equivalencias: "1878 000 615, 3400700110",
      observaciones: "Cerámica parcial",
    },
  },
  {
    primaryCode: "DISCO-310-6E",
    description: "Disco agrícola 310 mm",
    values: {
      codigo: "DISCO-310-6E",
      descripcion: "Disco agrícola 310 mm",
      marca: "Eaton",
      medida: "310 mm",
      aplicacion: "John Deere",
      equivalencias: "1878 000 620, RE211174",
      observaciones: "Tractor serie 6M",
    },
  },
  {
    primaryCode: "DISCO-430-10S",
    description: "Disco orgánico 430 mm",
    values: {
      codigo: "DISCO-430-10S",
      descripcion: "Disco orgánico 430 mm",
      marca: "Sachs",
      medida: "430 mm",
      aplicacion: "Mercedes-Benz Axor",
      equivalencias: "1878 000 630, 3400700120",
      observaciones: "Uso mixto",
    },
  },
  {
    primaryCode: "DISCO-400-10E",
    description: "Disco de embrague 400 mm",
    values: {
      codigo: "DISCO-400-10E",
      descripcion: "Disco de embrague 400 mm",
      marca: "Valeo",
      medida: "400 mm",
      aplicacion: "Scania Serie 4",
      equivalencias: "1878 000 640, 3400700130",
      observaciones: "Alta temperatura",
    },
  },
  {
    primaryCode: "DISCO-352-10E",
    description: "Disco liviano 352 mm",
    values: {
      codigo: "DISCO-352-10E",
      descripcion: "Disco liviano 352 mm",
      marca: "Eaton",
      medida: "352 mm",
      aplicacion: "Iveco Stralis",
      equivalencias: "1878 000 650, 3400700140",
      observaciones: "Distribución urbana",
    },
  },
  {
    primaryCode: "DISCO-280-6E",
    description: "Disco compacto 280 mm",
    values: {
      codigo: "DISCO-280-6E",
      descripcion: "Disco compacto 280 mm",
      marca: "Sachs",
      medida: "280 mm",
      aplicacion: "John Deere",
      equivalencias: "1878 000 660, RE211180",
      observaciones: "Retroexcavadora",
    },
  },
  {
    primaryCode: "DISCO-430-10H",
    description: "Disco híbrido 430 mm",
    values: {
      codigo: "DISCO-430-10H",
      descripcion: "Disco híbrido 430 mm",
      marca: "Valeo",
      medida: "430 mm",
      aplicacion: "Mercedes-Benz Axor",
      equivalencias: "1878 000 670, 3400700150",
      observaciones: "Larga duración",
    },
  },
  {
    primaryCode: "DISCO-362-10E",
    description: "Disco intermedio 362 mm",
    values: {
      codigo: "DISCO-362-10E",
      descripcion: "Disco intermedio 362 mm",
      marca: "Eaton",
      medida: "362 mm",
      aplicacion: "Scania Serie 4",
      equivalencias: "1878 000 680, 3400700160",
      observaciones: "Carga media",
    },
  },
];

const placasProducts: ProductSeed[] = [
  {
    primaryCode: "PLACA-55120IAR",
    description: "Placa de presión 430 mm",
    values: {
      codigo: "PLACA-55120IAR",
      descripcion: "Placa de presión 430 mm",
      marca: "Sachs",
      aplicacion: "Mercedes-Benz Axor",
      modelo: "Actros 1840",
      medida: "430 mm",
      cantidad_estrias: 10,
      montadora: "Mercedes-Benz",
      codigo_imagen: "IMG-P55120-01",
      equivalencias: "3482 000 591, 3400700501",
    },
  },
  {
    primaryCode: "PLACA-43010-Valeo",
    description: "Placa de presión reforzada",
    values: {
      codigo: "PLACA-43010-Valeo",
      descripcion: "Placa de presión reforzada",
      marca: "Valeo",
      aplicacion: "Scania Serie 4",
      modelo: "P410",
      medida: "430 mm",
      cantidad_estrias: 10,
      montadora: "Scania",
      codigo_imagen: "IMG-P43010-02",
      equivalencias: "3482 000 602, 3400700502",
    },
  },
  {
    primaryCode: "PLACA-39510-Eaton",
    description: "Placa de presión 395 mm",
    values: {
      codigo: "PLACA-39510-Eaton",
      descripcion: "Placa de presión 395 mm",
      marca: "Eaton",
      aplicacion: "Iveco Stralis",
      modelo: "Cursor 10",
      medida: "395 mm",
      cantidad_estrias: 10,
      montadora: "Iveco",
      codigo_imagen: "IMG-P39510-03",
      equivalencias: "3482 000 615, 3400700503",
    },
  },
  {
    primaryCode: "PLACA-3106-Sachs",
    description: "Placa agrícola 310 mm",
    values: {
      codigo: "PLACA-3106-Sachs",
      descripcion: "Placa agrícola 310 mm",
      marca: "Sachs",
      aplicacion: "John Deere",
      modelo: "6190R",
      medida: "310 mm",
      cantidad_estrias: 6,
      montadora: "John Deere",
      codigo_imagen: "IMG-P3106-04",
      equivalencias: "3482 000 620, RE211200",
    },
  },
  {
    primaryCode: "PLACA-40010-Valeo",
    description: "Placa de presión 400 mm",
    values: {
      codigo: "PLACA-40010-Valeo",
      descripcion: "Placa de presión 400 mm",
      marca: "Valeo",
      aplicacion: "Mercedes-Benz Axor",
      modelo: "Axor 2540",
      medida: "400 mm",
      cantidad_estrias: 10,
      montadora: "Mercedes-Benz",
      codigo_imagen: "IMG-P40010-05",
      equivalencias: "3482 000 630, 3400700505",
    },
  },
  {
    primaryCode: "PLACA-36210-Eaton",
    description: "Placa intermedia 362 mm",
    values: {
      codigo: "PLACA-36210-Eaton",
      descripcion: "Placa intermedia 362 mm",
      marca: "Eaton",
      aplicacion: "Scania Serie 4",
      modelo: "G440",
      medida: "362 mm",
      cantidad_estrias: 10,
      montadora: "Scania",
      codigo_imagen: "IMG-P36210-06",
      equivalencias: "3482 000 640, 3400700506",
    },
  },
  {
    primaryCode: "PLACA-35210-Sachs",
    description: "Placa liviana 352 mm",
    values: {
      codigo: "PLACA-35210-Sachs",
      descripcion: "Placa liviana 352 mm",
      marca: "Sachs",
      aplicacion: "Iveco Stralis",
      modelo: "Cursor 13",
      medida: "352 mm",
      cantidad_estrias: 10,
      montadora: "Iveco",
      codigo_imagen: "IMG-P35210-07",
      equivalencias: "3482 000 650, 3400700507",
    },
  },
  {
    primaryCode: "PLACA-2806-Valeo",
    description: "Placa compacta 280 mm",
    values: {
      codigo: "PLACA-2806-Valeo",
      descripcion: "Placa compacta 280 mm",
      marca: "Valeo",
      aplicacion: "John Deere",
      modelo: "7230R",
      medida: "280 mm",
      cantidad_estrias: 6,
      montadora: "John Deere",
      codigo_imagen: "IMG-P2806-08",
      equivalencias: "3482 000 660, RE211210",
    },
  },
  {
    primaryCode: "PLACA-43010-SKF",
    description: "Placa de presión premium",
    values: {
      codigo: "PLACA-43010-SKF",
      descripcion: "Placa de presión premium",
      marca: "SKF",
      aplicacion: "Mercedes-Benz Axor",
      modelo: "Actros 1845",
      medida: "430 mm",
      cantidad_estrias: 10,
      montadora: "Mercedes-Benz",
      codigo_imagen: "IMG-P43010-09",
      equivalencias: "3482 000 670, 3400700509",
    },
  },
  {
    primaryCode: "PLACA-39510-Sachs",
    description: "Placa de presión reforzada 395",
    values: {
      codigo: "PLACA-39510-Sachs",
      descripcion: "Placa de presión reforzada 395",
      marca: "Sachs",
      aplicacion: "Scania Serie 4",
      modelo: "R500",
      medida: "395 mm",
      cantidad_estrias: 10,
      montadora: "Scania",
      codigo_imagen: "IMG-P39510-10",
      equivalencias: "3482 000 680, 3400700510",
    },
  },
];

export const mockCatalogs: MockCatalog[] = [
  {
    id: "catalog-rulemanes",
    name: "Rulemanes",
    description: "Rodamientos, tensores y componentes de rotación para transporte pesado.",
    order: 0,
    visibleToNormalUser: true,
    folders: [
      buildFolder(
        "catalog-rulemanes",
        "folder-rodamientos",
        "Rodamientos",
        0,
        SEVEN_COLUMN_DEFINITIONS,
        rodamientosProducts,
      ),
      buildFolder(
        "catalog-rulemanes",
        "folder-tensores-pesados",
        "Tensores pesados",
        1,
        TEN_COLUMN_DEFINITIONS,
        tensoresPesadosProducts,
      ),
    ],
  },
  {
    id: "catalog-embragues",
    name: "Embragues",
    description: "Discos, placas y kits de embrague para camiones y maquinaria.",
    order: 1,
    visibleToNormalUser: true,
    folders: [
      buildFolder(
        "catalog-embragues",
        "folder-discos",
        "Discos",
        0,
        SEVEN_COLUMN_DEFINITIONS,
        discosProducts,
      ),
      buildFolder(
        "catalog-embragues",
        "folder-placas",
        "Placas",
        1,
        TEN_COLUMN_DEFINITIONS,
        placasProducts,
      ),
    ],
  },
];
