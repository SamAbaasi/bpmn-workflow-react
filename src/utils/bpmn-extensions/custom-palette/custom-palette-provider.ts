export default class CustomPaletteProvider {
  static $inject: string[];
  constructor( palette:any) {
    palette.registerProvider(this);
  }

  getPaletteEntries() {
    return function (entries: any) {
      delete entries['create.subprocess-expanded'];
      delete entries['create.data-object'];
      delete entries['create.group'];
      delete entries['create.data-store'];
      delete entries['create.participant-expanded'];
      // delete entries["create.intermediate-event"];
      return entries;
    };
  }
}

CustomPaletteProvider.$inject = [ 'palette'];
