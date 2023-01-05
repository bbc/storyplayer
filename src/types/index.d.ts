
declare global {
	interface Window {
		publicApi: any,
		playerInterface: any,
        safari: any,
        WebKitMediaSource: string,
        _sessionManager: any,
        playoutMedia: any,
        playout: any,
        activePlayer: any,
	}

    interface Document {
        webkitFullscreenElement: any,
        mozFullScreenElement: any,
        msFullscreenElement: any,
        mozCancelFullScreen: any,
        msExitFullscreen: any,
        webkitExitFullscreen: any,
        webkitHidden: any,
    }

    interface HTMLElement {
        mozRequestFullScreen: any,
        webkitRequestFullscreen: any,
    }
}

export interface Tags { [key: string]: Array<string> }

export interface SourceLocation { [key: string]: string }

export interface Experience {
    stories: Array<Story>,
    narrative_elements: Array<NarrativeElement>,
    representation_collections: Array<RepresentationCollection>,
    representations: Array<Representation>,
    asset_collections: Array<AssetCollection>,
}

export interface Beginning {
    narrative_element_id: string,
    condition: object,
}

export interface Link {
    link_type: string,
    condition: object,
    description?: string,
    target_narrative_element_id?: string,
    link_rank?: number,
    override_as_chosen?: boolean,
}

interface Meta {
    romper?: {
        requirements?: Array<{logic: object, errorMsg?: string}>,
    },
    storyplayer?: {
        disable_tab_defocus?: boolean,
        taster?: {
            hideDuringExperience: boolean,
        },
    }
}

export interface Story {
    id: string,
    version: string,
    name: string,
    tags?: Tags,
    beginnings: Array<Beginning>,
    narrative_element_ids: Array<string>,
    meta?: Meta,
    variables?: object,
}

export interface NarrativeElement {
    id: string,
    version: string,
    name: string,
    description: string,
    tags: Tags,
    body: {
        type: string,
        representation_collection_target_id?: string,
        story_target_id?: string,
    },
    links: Array<Link>,
}

export interface RepresentationCollection {
    id: string,
    version: string,
    name: string,
    tags: Tags,
    representations: Array<{
        representation_id: string,
        condition: object,
    }>,
}

export interface RepresentationChoice {
    label: string,
    choice_representation_id: string,
    choice_representation?: Representation,
}

export interface Behaviour {
    id: string,
    type: string,
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
    duration?: number,
    targetVolume?: number,
    startVolume?: number,
}

export interface DuringBehaviour {
    behaviour: Behaviour,
    start_time: number,
    duration?: number,
}

export interface Representation {
    id: string,
    version: string,
    name: string,
    tags: Tags,
    representation_type: string,
    description?: string,
    asset_collections: {
        foreground_id?: string,
        background_ids?: Array<string>,
        background_image?: string,
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
    meta?: object,
    choices?: Array<RepresentationChoice>,
    behaviours?: {
        completed?: Array<Behaviour>,
        during?: Array<DuringBehaviour>,
    },
}

export interface AssetCollection {
    id: string,
    version: string,
    name: string,
    tags: Tags,
    loop?: boolean,
    asset_collection_type: string,
    meta?: {
        romper?: {
            in?: string,
            out?: string,
        }
    },
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
}

export interface StoryFetcher { (id: string): Promise<Story> }
export interface NarrativeElementFetcher { (id: string) : Promise<NarrativeElement> }
export interface RepresentationCollectionFetcher { (id: string) : Promise<RepresentationCollection> }
export interface RepresentationFetcher { (id: string) : Promise<Representation> }
export interface AssetCollectionFetcher { (id: string) : Promise<AssetCollection> }
export interface MediaFetcher { (uri: string, options?: object) : Promise<string> }

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
}

export interface Renderers { [type: string]: BaseRenderer }

export interface DataResolver {
    get: { (name: string): Promise<any> },
    set: { (name: string, value: string): any },
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
    assetCollectionFetcher: AssetCollectionFetcher,
    options?: Record<string, string>,
}

export interface AssetUrls {
    noAssetIconUrl: string,
    noBackgroundAssetUrl?: string,
}

export interface SMPPlayListItem {
    href?: Array<Record<string, string>>
    url?: string
    kind?: string
    captionsUrl?: string
}

export interface SMPPlayList {
    summary: string,
    options: {
        useCredentials: boolean | Array<string>,
    },
    config: object,
    playlist: {
        id: string,
        items: Array<SMPPlayListItem>,
    }
}