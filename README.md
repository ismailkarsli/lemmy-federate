# Lemmy Federate

Lemmy Federate is a tool to federate Lemmy/Mbin communities automatically between instances.

## Requirements

For a Fediverse app to be compatible with Lemmy Federate, it must meet the following conditions:

- It must be discoverable by other instances.
- It should either have an endpoint that shows all admins or return the role when querying individual users.
- It should provide an endpoint to discover/search remote communities.
- It should provide an endpoint to the list of subscribed communities and newest communities.
- It should provide all federated instances.
- It should provide these community fields with API:

| field name | required | description |
| --- | --- | --- |
| name | [x] | serialized community name. |
| subscribed | [x] | does the logged-in user follow the community? |
| nsfw | [ ] | required only if the instances can contain nsfw. |
| local_subscribers | [ ] | required to determine whether to unsubscribe or not. highly recommended. |
| deleted/removed | [ ] | community is deleted by creator or removed by admin. if not provided, the API should at least return 404 status. |
| public | [ ] | is the community **local only** and not federated. |
