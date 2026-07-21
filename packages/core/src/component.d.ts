declare global {
    interface Window {
        JQHTML_DEBUG?: {
            log: (componentName: string, phase: string, message: string, data?: any) => void;
            updateTree: () => void;
        };
    }
}
export declare class Jqhtml_Component {
    $: any;
    args: Record<string, any>;
    data: Record<string, any>;
    _cid: string;
    _ready_state: number;

    // Lifecycle methods
    render(): Promise<void>;
    redraw(): Promise<void>;
    reload(): Promise<void>;
    create(): Promise<void>;
    ready(): Promise<void>;
    destroy(): void;

    // Private lifecycle methods (internal use only)
    _load(): Promise<void>;

    // Lifecycle hooks
    on_render(): void;
    on_create(): void;
    on_load(): Promise<void>;
    on_ready(): Promise<void>;
    on_destroy(): void;

    // Public API
    gate_load(promise: Promise<any>): void;
    should_rerender(): boolean;
    emit(event_name: string, event_data?: any): void;
    on(event_name: string, callback: (component: Jqhtml_Component) => void): this;
    $sid(local_id: string): any;
    id(local_id: string): Jqhtml_Component | null;
    instantiator(): Jqhtml_Component | null;
    find(selector: string): Jqhtml_Component[];
    closest(selector: string): Jqhtml_Component | null;
    component_name(): string;

    constructor(element?: any, args?: Record<string, any>);

    static get_class_hierarchy(): string[];
}
declare global {
    interface JQuery {
        component(component_class?: any, args?: Record<string, any>): Jqhtml_Component | JQuery;
    }
}
export declare function register_component(name: string, component_class: any): void;
export declare function get_component_class(name: string): any;
export declare function create_component(name: string, args?: Record<string, any>, element?: JQuery): Jqhtml_Component;
//# sourceMappingURL=component.d.ts.map