{{if .plugins.design -}}
import { Then, When } from 'quickpickle';
import { opensTheDesignPage, seesTheStartingPoint } from '../../tasks/design';

When('they open the design page', () => opensTheDesignPage());

Then('they see the starting point for a design', () => seesTheStartingPoint());
{{- end}}
