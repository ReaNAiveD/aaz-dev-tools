import * as React from 'react';
import { Typography, Box, AppBar, Toolbar, IconButton, Button, Container, Autocomplete, TextField, Backdrop, CircularProgress, List, ListSubheader, ListItem, ListItemButton, ListItemIcon, Checkbox, ListItemText, Paper } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import EditorPageLayout from '../../components/EditorPageLayout';
import { styled } from '@mui/material/styles';


interface SwaggerResourcePickerProps {
    workspaceName: string,
    plane: string,
    onClose: any
}

interface SwaggerResourcePickerState {
    loading: boolean

    plane: string

    // preModuleName: string | null
    // preResourceProvider: string | null
    // preVersion: string | null

    moduleOptions: string[],
    resourceProviderOptions: string[],
    versionOptions: string[],

    versionResourceIdMap: VersionResourceIdMap,
    resourceOptions: string[],

    existingResources: Set<string>,
    selectedResources: Set<string>,

    moduleOptionsCommonPrefix: string,
    resourceProviderOptionsCommonPrefix: string,

    selectedModule: string | null,
    selectedResourceProvider: string | null,
    selectedVersion: string | null,
}



type ResourceVersion = {
    version: string
}

type Resource = {
    id: string
    versions: ResourceVersion[]
}

type ResourceIdVersionSelectedMap = {
    [id: string]: string
}

type VersionResourceIdMap = {
    [version: string]: string[]
}

// type Resources = {
//     [id: string]: Version[]
// }

const MiddlePadding = styled(Box)(({ theme }) => ({
    height: '2vh'
}));

const MiddlePadding2 = styled(Box)(({ theme }) => ({
    height: '8vh'
}));

class SwaggerResourcePicker extends React.Component<SwaggerResourcePickerProps, SwaggerResourcePickerState> {

    constructor(props: SwaggerResourcePickerProps) {
        super(props);
        this.state = {
            loading: false,
            // preModuleName: null,
            // preResourceProvider: null,
            // preVersion: null,
            existingResources: new Set(),

            plane: this.props.plane,
            moduleOptionsCommonPrefix: '',
            resourceProviderOptionsCommonPrefix: '',
            moduleOptions: [],
            versionOptions: [],

            resourceProviderOptions: [],
            selectedResources: new Set(),
            resourceOptions: [],

            versionResourceIdMap: {},

            selectedModule: null,
            selectedResourceProvider: null,
            selectedVersion: null
        }
    }

    componentDidMount() {
        this.loadWorkspaceResources().then(() => {
            this.loadSwaggerModules(this.props.plane);
        })
    }

    handleClose = () => {
        this.props.onClose()
    }

    handleSubmit = () => {
        this.addSwagger()
    }

    loadSwaggerModules = (plane: string) => {
        axios.get(`/Swagger/Specs/${plane}`)
            .then((res) => {
                const options: string[] = res.data.map((v: any) => (v.url));
                this.setState(preState => {
                    return {
                        ...preState,
                        moduleOptions: options,
                        moduleOptionsCommonPrefix: `/Swagger/Specs/${plane}/`,
                        preModuleName: null,
                    }
                });
            })
            .catch((err) => console.log(err.response));
    }

    loadResourceProviders = (moduleUrl: string | null) => {
        if (moduleUrl != null) {
            axios.get(`${moduleUrl}/ResourceProviders`)
                .then((res) => {
                    const options: string[] = res.data.map((v: any) => (v.url));
                    const selectedResourceProvider = options.length === 1 ? options[0] : null;
                    this.setState({
                        resourceProviderOptions: options,
                        resourceProviderOptionsCommonPrefix: `${moduleUrl}/ResourceProviders/`
                    });
                    this.onResourceProviderUpdate(selectedResourceProvider);
                })
                .catch((err) => console.log(err.response.message));
        } else {
            this.setState({
                resourceProviderOptions: [],
            })
            this.onResourceProviderUpdate(null);
        }
    }

    loadWorkspaceResources = () => {
        return axios.get(`/AAZ/Editor/Workspaces/${this.props.workspaceName}/CommandTree/Nodes/aaz/Resources`)
            .then(res => {
                console.log(res);
                const existingResources = new Set<string>();
                // let preModuleName: string | null = null;
                // let preResourceProvider: string | null = null;
                // let preVersion: string | null = null;

                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    const pieces = res.data[0].swagger.slice().replace(`/ResourceProviders/`, ' ').split(' ')
                    // preModuleName = `/Swagger/Specs/${pieces[0]}`;
                    // preResourceProvider = pieces[1].split('/')[0]
                    // preVersion = res.data[0].version
                    res.data.forEach(resource => {
                        existingResources.add(resource.id);
                    });
                }
                this.setState({
                    // preModuleName: preModuleName,
                    // preResourceProvider: preResourceProvider,
                    // preVersion: preVersion,
                    existingResources: existingResources,
                })
            })
            .catch((err) => console.log(err.response));
    }

    loadResources = (resourceProviderUrl: string | null) => {
        if (resourceProviderUrl != null) {
            this.setState({
                loading: true,
            })
            axios.get(`${resourceProviderUrl}/Resources`)
                .then(res => {
                    // const resourceIdVersionMap: ResourceIdVersionMap = {}
                    const versionResourceIdMap: VersionResourceIdMap = {}
                    const versionOptions: string[] = []
                    res.data.forEach((resource: Resource) => {
                        // resource.versions.sort((a, b) =>  a.version.localeCompare(b.version));
                        const resourceVersions = resource.versions.map((v) => v.version)
                        // resourceIdVersionMap[resource.id] = versions;
                        resourceVersions.forEach((v) => {
                            if (!(v in versionResourceIdMap)) {
                                versionResourceIdMap[v] = [];
                                versionOptions.push(v);
                            }
                            versionResourceIdMap[v].push(resource.id);
                        })
                    })
                    versionOptions.sort((a, b) => a.localeCompare(b)).reverse()
                    let selectVersion = null;
                    if (versionOptions.length > 0) {
                        selectVersion = versionOptions[0];
                    }
                    this.setState({
                        loading: false,
                        versionResourceIdMap: versionResourceIdMap,
                        versionOptions: versionOptions,
                    })
                    this.onVersionUpdate(selectVersion);
                })
                .catch((err) => {
                    console.log(err.response);
                    this.setState({
                        loading: false,
                    });
                })
        } else {
            this.setState({
                versionOptions: [],
            })
            this.onVersionUpdate(null)
        }
    }

    addSwagger = () => {

        const { selectedResources, selectedVersion, selectedModule, moduleOptionsCommonPrefix } = this.state;
        const resources: { id: string }[] = [];
        selectedResources.forEach((resourceId) => {
            resources.push({
                id: resourceId
            })
        });

        const requestBody = {
            module: selectedModule!.slice().replace(moduleOptionsCommonPrefix, ''),
            version: selectedVersion,
            resources: resources,
        }

        this.setState({
            loading: true
        });

        axios.post(`/AAZ/Editor/Workspaces/${this.props.workspaceName}/CommandTree/Nodes/aaz/AddSwagger`, requestBody)
            .then(res => {
                this.setState({
                    loading: false
                });
                this.props.onClose();
            })
            .catch((err) => console.log(err.response));
    }

    onModuleSelectorUpdate = (moduleValueUrl: string | null) => {
        if (this.state.selectedModule != moduleValueUrl) {
            this.loadResourceProviders(moduleValueUrl);
        }
        this.setState({
            selectedModule: moduleValueUrl
        });
    }

    onResourceProviderUpdate = (resourceProviderUrl: string | null) => {
        if (this.state.selectedResourceProvider != resourceProviderUrl) {
            this.loadResources(resourceProviderUrl);
        }
        this.setState({
            selectedResourceProvider: resourceProviderUrl
        })
    }

    onVersionUpdate = (version: string | null) => {
        this.setState(preState => {
            let selectedResources = preState.selectedResources;
            let resourceOptions: string[] = [];
            if (version != null) {
                selectedResources = new Set();
                resourceOptions = [...preState.versionResourceIdMap[version]]
                    .sort((a, b) => a.localeCompare(b))
                    .filter(value => !preState.existingResources.has(value));
                resourceOptions.forEach((resourceId) => {
                    if (preState.selectedResources.has(resourceId)) {
                        selectedResources.add(resourceId);
                    }
                })
            }
            return {
                ...preState,
                resourceOptions: resourceOptions,
                selectedVersion: version,
                selectedResources: selectedResources,
            }
        })
    }

    onResourceItemClick = (resourceId: string) => {
        return () => {
            this.setState(preState => {
                const selectedResources = new Set(preState.selectedResources);
                if (selectedResources.has(resourceId)) {
                    selectedResources.delete(resourceId);
                } else if (!preState.existingResources.has(resourceId)) {
                    selectedResources.add(resourceId);
                }
                console.log(selectedResources);
                return {
                    ...preState,
                    selectedResources: selectedResources,
                }
            })
        }
    }

    render() {
        const { selectedResources, existingResources, resourceOptions, selectedVersion, selectedModule } = this.state;
        return (
            <React.Fragment>
                <AppBar sx={{ position: "fixed" }}>
                    <Toolbar>
                        <IconButton
                            edge="start"
                            color="inherit"
                            onClick={this.handleClose}
                            aria-label="close"
                        >
                            <CloseIcon />
                        </IconButton>
                        <Typography sx={{ ml: 2, flex: 1, flexDirection: "row", display: "flex", justifyContent: "center", alignContent: "center" }} variant='h5' component='div'>
                            Add Swagger Resources
                        </Typography>
                        
                    </Toolbar>
                </AppBar>
                <EditorPageLayout
                >
                    <Box sx={{
                        flexShrink: 0,
                        width: 250,
                        flexDirection: 'column',
                        display: 'flex',
                        alignItems: 'stretch',
                        justifyContent: 'flex-start',
                        marginRight: '3vh'
                    }}>
                        <ListSubheader> Swagger Filters</ListSubheader>
                        <MiddlePadding />
                        <SwaggerItemSelector
                            name='Swagger Module'
                            commonPrefix={this.state.moduleOptionsCommonPrefix}
                            options={this.state.moduleOptions}
                            value={this.state.selectedModule}
                            onValueUpdate={this.onModuleSelectorUpdate} />
                        <MiddlePadding />
                        <SwaggerItemSelector
                            name='Resource Provider'
                            commonPrefix={this.state.resourceProviderOptionsCommonPrefix}
                            options={this.state.resourceProviderOptions}
                            value={this.state.selectedResourceProvider}
                            onValueUpdate={this.onResourceProviderUpdate}
                        />
                        <MiddlePadding />
                        <SwaggerItemSelector
                            name='API Version'
                            commonPrefix=''
                            options={this.state.versionOptions}
                            value={this.state.selectedVersion}
                            onValueUpdate={this.onVersionUpdate}
                        />
                        <MiddlePadding2 />
                        <Button
                            variant="contained"
                            // sx={{
                            //     width: 250,
                            // }}
                            onClick={this.handleSubmit}
                            disabled={selectedModule == null || selectedVersion == null || selectedResources.size < 1}
                        >
                            Submit
                        </Button>
                    </Box>
                    <List
                        dense
                        sx={{ flexGrow: 1 }}
                        subheader={<ListSubheader>Resource Url</ListSubheader>}
                    >
                        {resourceOptions.map((option) => {
                            const labelId = `resource-${option}`;
                            return <ListItem
                                key={option}
                                disablePadding
                            >
                                <ListItemButton dense onClick={this.onResourceItemClick(option)}>
                                    <ListItemIcon>
                                        <Checkbox
                                            edge="start"
                                            checked={selectedResources.has(option) || existingResources.has(option)}
                                            tabIndex={-1}
                                            disableRipple
                                            inputProps={{ 'aria-labelledby': labelId }}
                                        />
                                    </ListItemIcon>
                                    <ListItemText id={labelId}
                                        primary={option}
                                        primaryTypographyProps={{
                                            variant: "h6",
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        })}
                    </List>
                </EditorPageLayout>
                <Backdrop
                    sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
                    open={this.state.loading}
                >
                    <CircularProgress color='inherit' />
                </Backdrop>
            </React.Fragment>
        )
    }
}



interface SwaggerItemsSelectorProps {
    commonPrefix: string,
    options: string[],
    name: string,
    value: string | null,
    onValueUpdate: (value: string | null) => void
}


class SwaggerItemSelector extends React.Component<SwaggerItemsSelectorProps> {

    constructor(props: SwaggerItemsSelectorProps) {
        super(props);
        this.state = {
            value: this.props.options.length == 1 ? this.props.options[0] : null,
        }
    }

    render() {
        // const { value } = this.state;
        const { name, options, commonPrefix, value } = this.props;
        return (
            <Autocomplete
                id={name}
                value={value}
                // sx={{
                //     width: 250,
                // }}
                options={options}
                onChange={(event, newValue: any) => {
                    this.props.onValueUpdate(newValue);
                }}
                getOptionLabel={(option) => {
                    return option.replace(commonPrefix, '');
                }}
                renderOption={(props, option) => {
                    return (
                        <Box component='li'
                            {...props}
                        >
                            {option.replace(commonPrefix, '')}
                        </Box>
                    )
                }}
                selectOnFocus
                clearOnBlur
                renderInput={(params) => (
                    <TextField
                        {...params}
                        size='small'
                        // variant='filled'
                        label={name}
                    />
                )}
            />
        )
    }
}


export default SwaggerResourcePicker;
