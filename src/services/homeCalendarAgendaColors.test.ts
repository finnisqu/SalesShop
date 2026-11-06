import {describe,expect,it} from 'vitest';
import {DEFAULT_HOME_CALENDAR_SETTINGS,badgeColor,type HomeCalendarSettings} from '../store/homeCalendarSettings';
import {homeAgendaDotColors} from './homeCalendarAgendaColors';

function configure(...slots:HomeCalendarSettings['slots']):HomeCalendarSettings{
 return {...DEFAULT_HOME_CALENDAR_SETTINGS,slots};
}
describe('Home agenda bullet colors',()=>{
 it('matches the directly configured Tasks and Bids due badge colors',()=>{
  const settings=configure(
   {metric:'tasks',color:'green'},
   {metric:'bid-due',color:'purple'},
   {metric:'calls',color:'blue'},
   {metric:'emails',color:'orange'},
  );
  expect(homeAgendaDotColors(settings)).toEqual({
   task:badgeColor('green'),bid:badgeColor('purple'),
  });
 });
 it('uses the combined Due dates badge color for both kinds when dedicated badges are absent',()=>{
  const settings=configure(
   {metric:'due-dates',color:'red'},
   {metric:'calls',color:'blue'},
   {metric:'emails',color:'orange'},
   {metric:'none',color:'slate'},
  );
  expect(homeAgendaDotColors(settings)).toEqual({
   task:badgeColor('red'),bid:badgeColor('red'),
  });
 });
 it('uses direct category colors in preference to combined Due dates',()=>{
  const settings=configure(
   {metric:'due-dates',color:'red'},
   {metric:'tasks',color:'purple'},
   {metric:'bid-due',color:'green'},
   {metric:'calls',color:'orange'},
  );
  expect(homeAgendaDotColors(settings)).toEqual({
   task:badgeColor('purple'),bid:badgeColor('green'),
  });
 });
 it('avoids reusing default agenda colors assigned to different metrics',()=>{
  const settings=configure(
   {metric:'calls',color:'blue'},
   {metric:'emails',color:'orange'},
   {metric:'texts',color:'teal'},
   {metric:'quotes-sent',color:'purple'},
  );
  const {task,bid}=homeAgendaDotColors(settings);
  for(const reserved of ['blue','orange','teal','purple'] as const){
   expect(task).not.toBe(badgeColor(reserved));
   expect(bid).not.toBe(badgeColor(reserved));
  }
  expect(task).not.toBe(bid);
 });
 it('preserves available defaults when the colors are unassigned',()=>{
  const settings=configure(
   {metric:'calls',color:'teal'},
   {metric:'emails',color:'purple'},
   {metric:'texts',color:'red'},
   {metric:'none',color:'blue'},
  );
  expect(homeAgendaDotColors(settings)).toEqual({
   task:badgeColor('blue'),bid:badgeColor('orange'),
  });
 });
 it('uses a distinct unclaimed color for an unconfigured type',()=>{
  const settings=configure(
   {metric:'tasks',color:'orange'},
   {metric:'emails',color:'blue'},
   {metric:'calls',color:'teal'},
   {metric:'none',color:'slate'},
  );
  const {task,bid}=homeAgendaDotColors(settings);
  expect(task).toBe(badgeColor('orange'));
  expect(bid).not.toBe(task);
  expect(bid).not.toBe(badgeColor('blue'));
 });
});
