import * as uc from "@unfoldedcircle/integration-api";
import path from "path";

const driver = new uc.IntegrationAPI();

// Node.js 20.11 / 21.2
const __dirname = import.meta.dirname;

driver.init(path.join(__dirname, "light-driver.json"));

driver.on(uc.Events.Connect, async () => {
  await driver.setDeviceState(uc.DeviceStates.Connected);
});

driver.on(uc.Events.Disconnect, async () => {
  await driver.setDeviceState(uc.DeviceStates.Disconnected);
});

driver.on(uc.Events.SubscribeEntities, async (entityIds: string[]) => {
  // the integration will configure entities and subscribe for entity update events
  // the UC library automatically adds the subscribed entities
  // from available to configured
  // you can act on this event if you need for your device handling
  entityIds.forEach((entityId: string) => {
    console.log(`Subscribed entity: ${entityId}`);
  });
});

driver.on(uc.Events.UnsubscribeEntities, async (entityIds: string[]) => {
  // when the integration unsubscribed from certain entity updates,
  // the UC library automatically remove the unsubscribed entities
  // from configured
  // you can act on this event if you need for your device handling
  entityIds.forEach((entityId: string) => {
    console.log(`Unsubscribed entity: ${entityId}`);
  });
});

/**
 * Shared command handler for different entities.
 *
 * Called by the integration-API if a command is sent to a configured entity.
 *
 * @param entity button entity
 * @param cmdId command
 * @param params optional command parameters
 * @return status of the command
 */
const sharedCmdHandler: uc.CommandHandler = async function (
  entity: uc.Entity,
  cmdId: string,
  params?: {
    [key: string]: string | number | boolean;
  }
): Promise<uc.StatusCodes> {
  // let's add some hacky action to the button!
  if (entity.id === "my_button" && cmdId === uc.ButtonCommands.Push) {
    console.log("Got %s push request: toggling light", entity.id);
    // trigger a light command
    const lightEntity = driver.getConfiguredEntities().getEntity("my_unique_light_id");
    if (lightEntity) {
      await lightCmdHandler(lightEntity, uc.LightCommands.Toggle, undefined);
    }
    return uc.StatusCodes.Ok;
  }

  if (entity.id === "test_mediaplayer") {
    console.log("Got %s media-player command request: %s", entity.id, cmdId, params || "");

    return uc.StatusCodes.Ok;
  }

  console.log("Got %s command request: %s", entity.id, cmdId);

  return uc.StatusCodes.Ok;
};

/**
 * Dedicated light entity command handler.
 *
 * Called by the integration-API if a command is sent to a configured light-entity.
 *
 * @param entity light entity
 * @param cmdId command
 * @param params optional command parameters
 * @return status of the command
 */
const lightCmdHandler: uc.CommandHandler = async function (
  entity,
  cmdId,
  params?: {
    [key: string]: string | number | boolean;
  }
): Promise<uc.StatusCodes> {
  console.log("Got %s command request: %s", entity.id, cmdId);

  // in this example we just update the entity, but in reality, you'd turn on the light with your integration
  // and handle the events separately for updating the configured entities
  switch (cmdId) {
    case uc.LightCommands.Toggle:
      if (entity.attributes?.state === uc.LightStates.Off) {
        driver.updateEntityAttributes(entity.id, {
          [uc.LightAttributes.State]: uc.LightStates.On,
          [uc.LightAttributes.Brightness]: 255
        });
      } else if (entity.attributes?.state === uc.LightStates.On) {
        driver.updateEntityAttributes(entity.id, {
          [uc.LightAttributes.State]: uc.LightStates.Off,
          [uc.LightAttributes.Brightness]: 0
        });
      }
      break;
    case uc.LightCommands.On:
      // params is optional! Use a default if not provided.
      // A real lamp might store the last brightness value, otherwise the integration could also keep track of the last value.
      driver.updateEntityAttributes(entity.id, {
        [uc.LightAttributes.State]: uc.LightStates.On,
        [uc.LightAttributes.Brightness]: params && params.brightness ? params.brightness : 127
      });
      driver.updateEntityAttributes("test_mediaplayer", {
        [uc.MediaPlayerAttributes.Volume]: 24
      });
      break;
    case uc.LightCommands.Off:
      driver.updateEntityAttributes(entity.id, {
        [uc.LightAttributes.State]: uc.LightStates.Off,
        [uc.LightAttributes.Brightness]: 0
      });
      break;
    default:
      return uc.StatusCodes.NotImplemented;
  }

  return uc.StatusCodes.Ok;
};

// create a light entity
// normally you'd create this where your driver exposed the available entities
// The entity name can either be string (which will be mapped to english), or an object with multiple language entries.
const name = {
  de: "Mein Lieblingslicht",
  en: "My favorite light"
};

const lightEntity = new uc.Light("my_unique_light_id", name, {
  features: [uc.LightFeatures.OnOff, uc.LightFeatures.Dim],
  attributes: {
    [uc.LightAttributes.State]: uc.LightStates.Off,
    [uc.LightAttributes.Brightness]: 0
  }
});
lightEntity.setCmdHandler(lightCmdHandler);

// add entity as available
// this is important, so the core knows what entities are available
driver.addAvailableEntity(lightEntity);

const buttonEntity = new uc.Button("my_button", "Push the button!", {
  area: "test lab",
  cmdHandler: sharedCmdHandler
});
driver.addAvailableEntity(buttonEntity);

// add a media-player entity
const mediaPlayerEntity = new uc.MediaPlayer(
  "test_mediaplayer",
  { en: "Foobar uc.MediaPlayer" },
  {
    features: [
      uc.MediaPlayerFeatures.OnOff,
      uc.MediaPlayerFeatures.Dpad,
      uc.MediaPlayerFeatures.Home,
      uc.MediaPlayerFeatures.Menu,
      uc.MediaPlayerFeatures.ChannelSwitcher,
      uc.MediaPlayerFeatures.SelectSource,
      uc.MediaPlayerFeatures.ColorButtons,
      uc.MediaPlayerFeatures.PlayPause
    ],
    attributes: {
      [uc.MediaPlayerAttributes.State]: uc.MediaPlayerStates.Off,
      [uc.MediaPlayerAttributes.SourceList]: ["Radio", "Streaming", "Favorite 1", "Favorite 2", "Favorite 3"]
    },
    deviceClass: uc.MediaPlayerDeviceClasses.StreamingBox
  }
);
mediaPlayerEntity.setCmdHandler(sharedCmdHandler);
driver.addAvailableEntity(mediaPlayerEntity);
