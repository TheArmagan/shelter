import { Component, createSignal, JSX, Show } from "solid-js";
import { getSettings, installedPlugins, removePlugin, startPlugin, stopPlugin, StoredPlugin } from "../plugins";
import { devModeReservedId } from "../devmode";
import { css, classes } from "./Plugins.tsx.scss";
import {
  Header,
  HeaderTags,
  IconAdd,
  IconBin,
  IconCog,
  injectCss,
  ModalBody,
  ModalHeader,
  ModalRoot,
  openConfirmationModal,
  openModal,
  Space,
  Switch,
  focusring,
  tooltip,
  TextBox,
} from "@uwu/shelter-ui";
import PluginAddModal from "./PluginAddModal";
import Fuse from "fuse.js";

false && focusring;
false && tooltip;

let cssInjected = false;

export const PluginCard: Component<{
  id: string;
  plugin: StoredPlugin;
}> = (props) => {
  const [on, setOn] = createSignal(props.plugin.on);

  const isDev = () => props.id === devModeReservedId;

  return (
    <div class={classes.plugin}>
      <div class={classes.row}>
        <strong>{props.plugin.manifest.name}</strong>
        <Space />
        by
        <Space />
        <span class={classes.author}>{props.plugin.manifest.author}</span>
        <div style="flex:1" />
        <Show keyed when={getSettings(props.id)}>
          <button
            use:tooltip="Open settings"
            aria-label={`open settings for ${props.plugin.manifest.name}`}
            use:focusring
            class={classes.btn}
            style={on() ? "" : "opacity: 0"}
            onclick={() =>
              openModal((mprops) => (
                <ModalRoot>
                  <ModalHeader close={mprops.close}>Settings - {props.plugin.manifest.name}</ModalHeader>
                  <ModalBody>{getSettings(props.id)({})}</ModalBody>
                </ModalRoot>
              ))
            }
          >
            <IconCog />
          </button>
        </Show>
        <Show keyed when={!isDev()}>
          <button
            use:tooltip="Delete"
            aria-label={`delete ${props.plugin.manifest.name}`}
            use:focusring
            class={classes.btn}
            onclick={() =>
              openConfirmationModal({
                body: () => `Are you sure you want to delete plugin ${props.plugin.manifest.name}?`,
                header: () => "Confirm plugin deletion",
                type: "danger",
                confirmText: "Delete",
              }).then(
                () => removePlugin(props.id),
                () => {},
              )
            }
          >
            <IconBin />
          </button>
        </Show>
        <Switch
          aria-label={`${on() ? "disable" : "enable"} ${props.plugin.manifest.name}`}
          checked={on()}
          onChange={(newVal) => {
            if (props.plugin.on === newVal) return;
            setOn(!on());
            // oh no! i have to save my pretty animations! (this is utterly stupid)
            setTimeout(() => (newVal ? startPlugin(props.id) : stopPlugin(props.id)), 250);
          }}
        />
      </div>

      <span class={classes.desc}>{props.plugin.manifest.description}</span>
    </div>
  );
};

const fuzzy = (plugins: [string, StoredPlugin][], searchTerm: string) =>
  !searchTerm || searchTerm === ""
    ? plugins
    : new Fuse(plugins, {
        threshold: 0.5,
        useExtendedSearch: true,
        keys: ["1.manifest.name", "1.manifest.author", "1.manifest.description"],
      })
        .search(searchTerm)
        .map((res) => res.item);

export default (): JSX.Element => {
  if (!cssInjected) {
    injectCss(css);
    cssInjected = true;
  }

  const [searchTerm, setSearchTerm] = createSignal("");

  return (
    <div class={classes.list}>
      <Header tag={HeaderTags.H3}>
        Plugins
        <button
          use:tooltip="Add a plugin"
          aria-label="add a plugin"
          use:focusring
          class={classes.btn}
          onclick={() => openModal((props) => <PluginAddModal close={props.close} />)}
        >
          <IconAdd />
        </button>
      </Header>

      <TextBox value={searchTerm()} onInput={setSearchTerm} placeholder="Search plugins..." />

      {/* IIRC not using a <For> here was very intentional due to keying -- sink
       * the only way to do what we need cleanly in solid looks *like this*!:
       * https://codesandbox.io/s/explicit-keys-4iyen?file=/Key.js
       */}
      {fuzzy(Object.entries(installedPlugins()), searchTerm())
        .filter(([id]) => id !== devModeReservedId)
        .sort(([, pluginA], [, pluginB]) => {
          const nameA = pluginA.manifest.name?.toLowerCase();
          const nameB = pluginB.manifest.name?.toLowerCase();
          return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
        })
        .map(([id, plugin]) => (
          <PluginCard {...{ id, plugin }} />
        ))}
    </div>
  );
};
