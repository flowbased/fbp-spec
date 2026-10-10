/**
 * Ambient type declarations for dependencies without their own type information.
 * The shapes here are limited to what fbp-spec uses.
 */

declare module "fbp" {
  /**
   * Parse FBP graph definition text into a graph JSON payload.
   * @param source FBP graph language source
   * @param options Parsing options
   * @returns Graph JSON payload
   */
  export function parse(source: string, options?: { caseSensitive?: boolean }): object;
}

declare module "fbp-client" {
  /** A connected FBP protocol client. */
  export interface FbpClient {
    definition: {
      protocol?: string;
      address?: string;
      capabilities?: string[];
      namespace?: string;
      [key: string]: unknown;
    };
    options: Record<string, unknown>;
    isConnected(): boolean;
    connect(): Promise<object>;
    disconnect(): Promise<null>;
    observe(filter: (message: any) => boolean): {
      signals: { payload: Record<string, any> }[];
      until(
        onSuccess: (message: any) => boolean,
        onFailure?: (message: any) => boolean,
      ): Promise<{ payload: Record<string, any> }[]>;
    };
    on(event: string, listener: (...args: any[]) => void): void;
    transport: {
      setParentElement(element: unknown): void;
      [key: string]: unknown;
    };
    protocol: {
      graph: {
        send(graph: object, main?: boolean): Promise<object>;
        clear(payload: object): Promise<object>;
        addnode(payload: object): Promise<object>;
        addedge(payload: object): Promise<object>;
        addinitial(payload: object): Promise<object>;
        addinport(payload: object): Promise<object>;
        addoutport(payload: object): Promise<object>;
      };
      network: {
        start(payload: object): Promise<object>;
        stop(payload: object): Promise<object>;
      };
      runtime: {
        getruntime(payload?: object): Promise<{ capabilities?: string[] }>;
        packet(payload: object): Promise<object>;
      };
      component: {
        list(): Promise<{ name: string; inPorts: { id: string }[]; outPorts: { id: string }[]; [key: string]: unknown }[]>;
        getsource(payload: { name: string }): Promise<{
          name: string;
          library?: string;
          tests?: string | null;
          [key: string]: unknown;
        }>;
      };
    };
  }

  /**
   * Create a FBP protocol client for a runtime.
   * @param definition Runtime definition
   * @param options Client options
   * @returns Client instance
   */
  function fbpClient(
    definition: object,
    options?: { commandTimeout?: number; connectionTimeout?: number },
  ): Promise<FbpClient>;
  export default fbpClient;
}

declare module "fbp-graph" {
  /** A FBP graph instance. */
  export interface Graph {
    name?: string;
    properties: Record<string, unknown>;
    nodes: unknown[];
    edges: unknown[];
    initializers: unknown[];
    inports: Record<string, unknown>;
    outports: Record<string, unknown>;
    [key: string]: unknown;
  }
  const fbpGraph: {
    Graph: new (name: string, options?: object) => Graph;
    graph: {
      loadJSON(
        definition: object | string,
        callback?: (err: Error | null, graph?: Graph) => void,
        metadata?: object,
      ): Promise<Graph>;
      loadFBP(
        source: string,
        callback?: (err: Error | null, graph?: Graph) => void,
        metadata?: object,
        caseSensitive?: boolean,
      ): Promise<Graph>;
    };
  };
  export default fbpGraph;
}

declare module "flowtrace" {
  /** Records FBP protocol traffic as replayable Flowtraces. */
  export class FlowtraceRecorder {
    constructor(client: object, options?: object);
    start(graphId: string): Promise<void>;
    stop(graphId: string): Promise<void>;
    dump(graphId: string): object;
    [key: string]: unknown;
  }
}

declare module "tv4" {
  /** Result of a tv4 validation. */
  export interface Tv4Result {
    valid: boolean;
    errors: { message: string; [key: string]: unknown }[];
    missing: string[];
    passed: boolean;
  }
  const tv4: {
    addSchema(id: string, schema: object): void;
    reset(): void;
    validateMultiple(data: unknown, schemaId: string): Tv4Result;
    validateResult(
      data: unknown,
      schemaId: string,
    ): { valid: boolean; errors: { message: string }[]; missing: string[] };
    [key: string]: unknown;
  };
  export default tv4;
}
