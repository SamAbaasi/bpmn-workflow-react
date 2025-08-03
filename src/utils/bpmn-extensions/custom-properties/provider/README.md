# custom properties typescript

The file where we customize our properties.

## Functions

- **getGroups():**

  Gets the groups in the panel.

- **removeGroup(element: any, groups: any):**

  Deletes the desired group for each desired element type.

- **addSenderGroup(element: any, groups: any,injector: any,translate: any):**

  Creates an sender group for all activities.

- **addEndExecutionListenerGroup(groups: any):**

  Creates an EndExecutionListener group for sendTask activity.

- **addStartExecutionListenerGroup(groups: any):**

  Creates a StartExecutionListener group for sendTask activity.

- **addMessageType(groups: any):**

  Creates a message type group.

- **addSMSConfiguration(groups: any):**

  Creates a SMS configuration group.
