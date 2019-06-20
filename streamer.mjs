import alt from "alt";
import { 
    ENTITY_STREAM_IN_EVENT, 
    ENTITY_STREAM_OUT_EVENT,
    ENTITY_DATA_UPDATE_EVENT,
    ENTITY_MOVE_EVENT
} from "./shared.mjs";

const TICK_UPDATE_DELAY = 1000;
const STREAMING_RANGE = 400;

let entities = [];

let tick = () => {
    alt.Player.all.forEach(
        (player) => {
            entities.forEach(
                (entity, entityID) => {
                    let shouldBeStreamed = shouldEntityBeStreamedToPlayer(
                        player,
                        entityID
                    );
                    let index = isEntityStreamedToPlayer(
                        player,
                        entityID
                    );

                    //Basically if something needs to be done.
                    if(shouldBeStreamed !== (index !== -1)) {
                        //To make it a bit faster pass index here too.
                        if(shouldBeStreamed) addEntityToPlayer(player, entityID, index);
                        else removeEntityFromPlayer(player, entityID, index);
                    }
                }
            );
        }
    )
}

setInterval(
    tick,
    1000
);

let dist = (pos1, pos2) => {
    let pos = {
        x: pos1.x - pos2.x,
        y: pos1.y - pos2.y,
        z: pos1.z - pos2.z
    };

    return Math.sqrt(
        pos.x*pos.x + pos.y*pos.y + pos.z*pos.z 
    );
};

let addEntityToPlayer = (player, entityID, index = null) => {
    if(index === null) isEntityStreamedToPlayer(player, entityID)
    
    if(index === -1) {
        let entity = entities[entityID];

        entity.syncedTo.push(player.id);

        player.emitClient(
            ENTITY_STREAM_IN_EVENT,
            entityID,
            entity
        );
    }
};

let removeEntityFromPlayer = (player, entityID, index = null) => {
    if(index === null) index = isEntityStreamedToPlayer(player, entityID);

    if(index !== -1) {
        let entity = entities[entityID];

        entity.syncedTo.splice(index, 1);

        player.emitClient(
            ENTITY_STREAM_OUT_EVENT,
            entityID,
            entity
        );
    }
};

//returns -1 if no; returns index if yes.
let isEntityStreamedToPlayer = (player, entityID) => {
    let entity = entities[entityID];

    let result = -1;

    entity.syncedTo.forEach(
        (playerID, index) => {
            if(playerID === player.id) result = index;
        }
    )

    return result;
}

let shouldEntityBeStreamedToPlayer = (player, entityID) => {
    let entity = entities[entityID];
    
    return dist(
        player.pos,
        entity.pos
    ) < STREAMING_RANGE;
}

let findUnusedEntityID = () => {
    for(let i = 0; i < entities.length; i++)
        if(entities[i] === undefined) return i;

    return entities.length;
};

export function createEntity(pos, data) {
    entity = {
        pos: {...pos},
        data: {...data},
        syncedTo: []
    };

    let id = findUnusedEntityID();
    entities[id] = entity;
}

export function updateEntityData(id, data) {
    if(!doesEntityExist(id)) return false;

    entities[id].data = {
        ...data
    };

    entities[id].syncedTo.forEach(
        (playerID) => {
            let player = alt.Player.all[playerID];

            player.emitClient(ENTITY_DATA_UPDATE_EVENT, id, entity);
        }
    );
    
    return true;
}

export function moveEntity(id, pos) {
    if(!doesEntityExist(id)) return false;

    entities[id].pos = {
        ...pos
    };

    let toRemove = [];
    entities[id].syncedTo.forEach(
        (playerID) => {
            let player = alt.Player.all[playerID];

            if(shouldEntityBeStreamedToPlayer(player, id))
                player.emitClient(ENTITY_MOVE_EVENT, id, entity);

            else toRemove.push(playerID);
        }
    );

    if(toRemove.length !== 0) toRemove.forEach(
        (playerID) => {
            removeEntityFromPlayer(
                alt.Player.all[playerID],
                id
            );
        }
    )

    //New players which/if are in streaming range will be added next tick.
    //Needed to remove player, in order to update position on their clients.

    return true;
}

export function destroyEntity(id) {
    entities[id] = undefined;
}

export function doesEntityExist(id) {
    return entities[id] !== undefined;
}