{{if .plugins.genie -}}
import { Then, When } from 'quickpickle';
import { canTypeAQuestion, isToldWhatGenieIsFor, opensTheGeniePage } from '../../tasks/genie';

When('they open the Genie page', () => opensTheGeniePage());

Then('they are told what Genie is for', () => isToldWhatGenieIsFor());
Then('they can type a question', () => canTypeAQuestion());
{{- end}}
