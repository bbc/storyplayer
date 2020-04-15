export interface Tags  {
    [key: string]: Array<string>
};

export interface SourceLocation  {
    [key: string]: string
};

export interface Experience {
    stories: Array<Story>,
    narrative_elements: Array<NarrativeElement>,
    representation_collections: Array<RepresentationCollection>,
    representations: Array<Representation>,
    asset_collections: Array<AssetCollection>,
}

export interface Beginning {
    narrative_element_id: string,
    condition: any,
};

export interface Link {
    link_interface: string,
    condition: any,
    description?: string,
    target_narrative_element_id?: string,
    link_rank?: number,
    override_as_chosen?: boolean,
};

export interface Story {
    id: string,
    version: string,
    name: string,
    tags?: Tags,
    beginnings: Array<Beginning>,
    narrative_element_ids: Array<string>,
    meta?: Object,
    variables?: Object,
};

export interface NarrativeElement {
    id: string,
    version: string,
    name: string,
    description: string,
    tags: Tags,
    body: {
        interface: string,
        representation_collection_target_id?: string,
        story_target_id?: string,
    },
    links: Array<Link>,
};

export interface RepresentationCollection {
    id: string,
    version: string,
    name: string,
    tags: Tags,
    representations: Array<{
        representation_id: string,
        condition: any,
    }>,
};

export interface RepresentationChoice {
    label: string,
    choice_representation_id: string,
    choice_representation?: Representation,
}

export interface Representation {
    id: string,
    version: string,
    name: string,
    tags: Tags,
    representation_interface: string,
    description?: string,
    asset_collections: {
        foreground_id?: string,
        background_ids?: Array<string>,
        icon?: {
            default_id: string,
            active_id?: string,
        },
        link_assets?: Array<{
            target_narrative_element_id: string,
            asset_collection_id: string,
        }>,
        behaviours?: Array<{
            behaviour_asset_collection_mapping_id: string,
            asset_collection_id: string
        }>
    },
    duration?: number,
    meta?: Object,
    choices?: Array<RepresentationChoice>,
    behaviours?: {
        started?: Array<{
            id: string,
            interface: string,
            pauseTime?: number,
            colour?: string,
            image?: string,
            blur?: string,
            show_ne_to_end?: boolean,
            one_shot?: boolean,
            disable_controls?: boolean,
            show_time_remaining?: boolean,
            force_choice?: boolean,
            overlay_class?: string,
        }>,
        completed?: Array<{
            id: String,
            interface: string,
            pauseTime?: number,
            colour?: string,
            image?: string,
            blur?: string,
            show_ne_to_end?: boolean,
            one_shot?: boolean,
            disable_controls?: boolean,
            show_time_remaining?: boolean,
            force_choice?: boolean,
            overlay_class?: string,
        }>,
        during?: Array<{
            behaviour: {
                id: string,
                interface: string,
                show_ne_to_end?: boolean,
                one_shot?: boolean,
                disable_controls?: boolean,
                show_time_remaining?: boolean,
                force_choice?: boolean,
                overlay_class?: string,
            },
            start_time: number,
            duration?: number,
        }>,
    },
};

export interface AssetCollection {
    id: string,
    version: string,
    name: string,
    tags: Tags,
    loop: boolean | undefined | null,
    asset_collection_interface: string,
    meta?: Object,
    assets: {
        audio_src?: string,
        image_src?: string,
        av_src?: string,
        sub_src?: string,
        text_content?: string,
        text_src?: string,
        video_format?: string,
        audio_format?: string,
    },
};

export type StoryFetcher = (id: string) => Promise<Story>;
export type NarrativeElementFetcher = (id: string) => Promise<NarrativeElement>;
export type RepresentationCollectionFetcher = (id: string) => Promise<RepresentationCollection>;
export type RepresentationFetcher = (id: string) => Promise<Representation>;
export type AssetCollectionFetcher = (id: string) => Promise<AssetCollection>;
export type MediaFetcher = (uri: string, options?:Object) => Promise<string>;

export interface ExperienceFetchers {
    storyFetcher: StoryFetcher,
    narrativeElementFetcher: NarrativeElementFetcher,
    representationCollectionFetcher: RepresentationCollectionFetcher,
    representationFetcher: RepresentationFetcher,
    assetCollectionFetcher: AssetCollectionFetcher,
    mediaFetcher: MediaFetcher
}


export interface BaseRenderer {
    representation: Representation,
    assetCollectionFetcher: AssetCollectionFetcher,
    mediaFetcher: MediaFetcher,
    target: HTMLElement,
};

export interface Renderers { [types: string]: BaseRenderer };

export interface DataResolver {
    get: (name: string) => Promise<any>,
    set: (name: string, value: any) => any,
}

export interface Settings {
    target: HTMLElement,
    renderers?: Renderers,
    dataResolver: DataResolver,
    storyFetcher: StoryFetcher,
    narrativeElementFetcher: NarrativeElementFetcher,
    representationCollectionFetcher: RepresentationCollectionFetcher,
    representationFetcher: RepresentationFetcher,
    mediaFetcher: MediaFetcher,
};

export interface AssetUrls {
    noAssetIconUrl: string,
    noBackgroundAssetUrl?: string,
}